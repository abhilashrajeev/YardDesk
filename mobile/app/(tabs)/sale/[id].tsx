import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, apiError } from '../../../lib/api';
import { cache } from '../../../lib/masterCache';
import { useAuth } from '../../../lib/auth';
import { Select } from '../../../components/Select';
import { LineEditor } from '../../../components/LineEditor';
import { Field, Button, Card, Pill } from '../../../components/ui';
import { colors, money, qty, fmtDate, statusColor } from '../../../lib/theme';
import type { Sale, Material, Party, Line, PaymentMode } from '../../../lib/types';

const MODES: { label: string; value: PaymentMode }[] = [
  { label: 'Cash', value: 'CASH' },
  { label: 'UPI', value: 'UPI' },
  { label: 'Bank', value: 'BANK' },
  { label: 'Credit', value: 'CREDIT' },
];

export default function SaleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const [sale, setSale] = useState<Sale | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [mode, setMode] = useState<PaymentMode>('CASH');
  const [freight, setFreight] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [lines, setLines] = useState<Line[]>([]);

  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.get<Sale>(`/sales/${id}`);
      setSale(data);
    } catch (e) {
      setError(apiError(e));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit() {
    if (!sale) return;
    (async () => {
      setMaterials(await cache.materials());
      setCustomers(await cache.customers());
    })();
    setCustomerId(sale.customerId ?? '');
    setMode(sale.paymentMode);
    setFreight(String(Number(sale.freight ?? 0)));
    setDiscount(String(Number(sale.discount ?? 0)));
    setLines((sale.items ?? []).map((it) => ({ materialId: it.materialId, quantity: Number(it.quantity), rate: Number(it.rate) })));
    setEditing(true);
  }

  async function saveEdit() {
    const items = lines.filter((l) => l.materialId && l.quantity > 0);
    if (!items.length) return Alert.alert('Add at least one item with quantity');
    setSaving(true);
    try {
      await api.patch(`/sales/${id}`, {
        customerId,
        paymentMode: mode,
        freight: Number(freight || 0),
        discount: Number(discount || 0),
        items,
      });
      setEditing(false);
      await load();
    } catch (e) {
      Alert.alert('Could not save', apiError(e));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert('Delete sale?', 'Stock and ledger effects will be reversed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/sales/${id}`);
            router.back();
          } catch (e) {
            Alert.alert('Could not delete', apiError(e));
          }
        },
      },
    ]);
  }

  async function issuePass(kind: 'gate-pass' | 'loading-pass') {
    try {
      await api.post(`/sales/${id}/${kind}`);
      await load();
    } catch (e) {
      Alert.alert('Could not issue pass', apiError(e));
    }
  }

  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.err}>{error}</Text>
      </View>
    );
  }
  if (!sale) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (editing) {
    return (
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
        <Card>
          <Select
            label="Customer"
            value={customerId}
            options={customers.map((c) => ({ label: c.name, value: c.id }))}
            onChange={setCustomerId}
          />
          <Select label="Payment mode" value={mode} options={MODES} onChange={(v) => setMode(v as PaymentMode)} />
        </Card>
        <Card>
          <Text style={s.h}>Items</Text>
          <LineEditor materials={materials} lines={lines} onChange={setLines} />
          <Field label="Transportation charge" value={freight} onChangeText={setFreight} keyboardType="decimal-pad" />
          <Field label="Discount" value={discount} onChangeText={setDiscount} keyboardType="decimal-pad" />
        </Card>
        <View style={s.editActions}>
          <View style={{ flex: 1 }}>
            <Button title="Cancel" variant="gray" onPress={() => setEditing(false)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title={saving ? 'Saving…' : 'Save changes'} onPress={saveEdit} loading={saving} />
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <View style={s.headRow}>
          <Text style={s.billNo}>Bill #{sale.billNo}</Text>
          {sale.status === 'CANCELLED' && <Pill text="CANCELLED" color={colors.red} />}
        </View>
        <Text style={s.customer}>{sale.customer?.name}</Text>
        <Text style={s.muted}>{fmtDate(sale.date)} · {sale.paymentMode}</Text>
      </Card>

      <Card>
        <Text style={s.h}>Items</Text>
        {sale.items?.map((it) => (
          <View key={it.id} style={s.itemRow}>
            <Text style={{ flex: 1, color: colors.text }}>{it.material?.name}</Text>
            <Text style={s.muted}>{qty(it.quantity)} {(it.unit ?? it.material?.unit)?.toLowerCase()}</Text>
            <Text style={[s.muted, { width: 70, textAlign: 'right' }]}>{money(it.rate)}</Text>
            <Text style={{ width: 80, textAlign: 'right', fontWeight: '700', color: colors.text }}>{money(it.amount)}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <View style={s.between}><Text style={s.muted}>Subtotal</Text><Text>{money(sale.subTotal)}</Text></View>
        <View style={s.between}><Text style={s.muted}>Transportation charge</Text><Text>{money(sale.freight)}</Text></View>
        {!!Number(sale.discount) && (
          <View style={s.between}><Text style={s.muted}>Discount</Text><Text>-{money(sale.discount)}</Text></View>
        )}
        <View style={[s.between, s.totalDivider]}><Text style={s.totalLabel}>Total</Text><Text style={s.totalValue}>{money(sale.total)}</Text></View>
        <View style={s.between}><Text style={s.muted}>Paid</Text><Text>{money(sale.paidAmount)}</Text></View>
        <View style={s.between}>
          <Text style={s.muted}>Balance</Text>
          <Text style={{ fontWeight: '700', color: (sale.balance ?? 0) > 0 ? colors.red : colors.green }}>{money(sale.balance)}</Text>
        </View>
      </Card>

      <Card>
        <View style={s.passRow}>
          {sale.gatePass ? (
            <Pill text={`Gate Pass #${sale.gatePass.passNo}`} color={colors.green} />
          ) : (
            <Button title="Issue Gate Pass" variant="ghost" onPress={() => issuePass('gate-pass')} />
          )}
        </View>
        <View style={[s.passRow, { marginTop: 8 }]}>
          {sale.loadingPass ? (
            <Pill text={`Loading Pass #${sale.loadingPass.passNo}`} color={colors.green} />
          ) : (
            <Button title="Issue Loading Pass" variant="ghost" onPress={() => issuePass('loading-pass')} />
          )}
        </View>
      </Card>

      {isAdmin && sale.status !== 'CANCELLED' && (
        <View style={s.editActions}>
          <View style={{ flex: 1 }}>
            <Button title="Edit" variant="gray" onPress={startEdit} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Delete" variant="gray" onPress={confirmDelete} />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  h: { fontWeight: '700', color: colors.text, marginBottom: 8 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  billNo: { fontSize: 17, fontWeight: '800', color: colors.text },
  customer: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 6 },
  muted: { color: colors.muted, fontSize: 13 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  between: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalDivider: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: 8 },
  totalLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  totalValue: { fontSize: 15, fontWeight: '800', color: colors.text },
  passRow: { flexDirection: 'row' },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 24 },
  err: { color: colors.red },
});
