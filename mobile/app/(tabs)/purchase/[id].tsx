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
import type { Purchase, Material, Party, Line } from '../../../lib/types';

export default function PurchaseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [vendors, setVendors] = useState<Party[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [freight, setFreight] = useState('0');
  const [lines, setLines] = useState<Line[]>([]);

  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.get<Purchase>(`/purchases/${id}`);
      setPurchase(data);
    } catch (e) {
      setError(apiError(e));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit() {
    if (!purchase) return;
    (async () => {
      setMaterials(await cache.materials());
      setVendors(await cache.vendors());
    })();
    setVendorId(purchase.vendorId ?? '');
    setFreight(String(Number(purchase.freight ?? 0)));
    setLines((purchase.items ?? []).map((it) => ({ materialId: it.materialId, quantity: Number(it.quantity), rate: Number(it.rate) })));
    setEditing(true);
  }

  async function saveEdit() {
    const items = lines.filter((l) => l.materialId && l.quantity > 0);
    if (!items.length) return Alert.alert('Add at least one item with quantity');
    setSaving(true);
    try {
      await api.patch(`/purchases/${id}`, {
        vendorId,
        freight: Number(freight || 0),
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
    Alert.alert('Delete purchase?', 'Stock and ledger effects will be reversed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/purchases/${id}`);
            router.back();
          } catch (e) {
            Alert.alert('Could not delete', apiError(e));
          }
        },
      },
    ]);
  }

  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.err}>{error}</Text>
      </View>
    );
  }
  if (!purchase) {
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
            label="Vendor"
            value={vendorId}
            options={vendors.map((v) => ({ label: v.name, value: v.id }))}
            onChange={setVendorId}
          />
        </Card>
        <Card>
          <Text style={s.h}>Items</Text>
          <LineEditor materials={materials} lines={lines} onChange={setLines} />
          <Field label="Transportation charge" value={freight} onChangeText={setFreight} keyboardType="decimal-pad" />
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
          <Text style={s.billNo}>{purchase.invoiceNo ?? 'Purchase'}</Text>
          {purchase.status === 'CANCELLED' && <Pill text="CANCELLED" color={colors.red} />}
        </View>
        <Text style={s.customer}>{purchase.vendor?.name}</Text>
        <Text style={s.muted}>{fmtDate(purchase.date)}{purchase.vehicle ? ` · ${purchase.vehicle.number}` : ''}</Text>
      </Card>

      <Card>
        <Text style={s.h}>Items</Text>
        {purchase.items?.map((it) => (
          <View key={it.id} style={s.itemRow}>
            <Text style={{ flex: 1, color: colors.text }}>{it.material?.name}</Text>
            <Text style={s.muted}>{qty(it.quantity)} {(it.unit ?? it.material?.unit)?.toLowerCase()}</Text>
            <Text style={[s.muted, { width: 70, textAlign: 'right' }]}>{money(it.rate)}</Text>
            <Text style={{ width: 80, textAlign: 'right', fontWeight: '700', color: colors.text }}>{money(it.amount)}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <View style={s.between}><Text style={s.muted}>Subtotal</Text><Text>{money(purchase.subTotal)}</Text></View>
        <View style={s.between}><Text style={s.muted}>Transportation charge</Text><Text>{money(purchase.freight)}</Text></View>
        <View style={[s.between, s.totalDivider]}><Text style={s.totalLabel}>Total</Text><Text style={s.totalValue}>{money(purchase.total)}</Text></View>
        <View style={s.between}><Text style={s.muted}>Paid</Text><Text>{money(purchase.paidAmount)}</Text></View>
        <View style={s.between}>
          <Text style={s.muted}>Balance</Text>
          <Text style={{ fontWeight: '700', color: (purchase.balance ?? 0) > 0 ? colors.red : colors.green }}>{money(purchase.balance)}</Text>
        </View>
      </Card>

      {isAdmin && purchase.status !== 'CANCELLED' && (
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
  editActions: { flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 24 },
  err: { color: colors.red },
});
