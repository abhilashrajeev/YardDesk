import { useEffect, useState } from 'react';
import { ScrollView, View, Text, Switch, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { cache } from '../../../lib/masterCache';
import { outbox } from '../../../lib/outbox';
import { syncNow } from '../../../lib/sync';
import { useNetwork } from '../../../lib/net';
import { Select } from '../../../components/Select';
import { LineEditor } from '../../../components/LineEditor';
import { Field, Button, Card } from '../../../components/ui';
import { colors, money } from '../../../lib/theme';
import type { Material, Party, Line, PaymentMode } from '../../../lib/types';

const MODES: { label: string; value: PaymentMode }[] = [
  { label: 'Cash', value: 'CASH' },
  { label: 'UPI', value: 'UPI' },
  { label: 'Bank', value: 'BANK' },
  { label: 'Credit', value: 'CREDIT' },
];

export default function NewSaleScreen() {
  const router = useRouter();
  const online = useNetwork();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [mode, setMode] = useState<PaymentMode>('CASH');
  const [freight, setFreight] = useState('0');
  const [lines, setLines] = useState<Line[]>([]);
  const [gatePass, setGatePass] = useState(false);
  const [loadingPass, setLoadingPass] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [m, c] = [await cache.materials(), await cache.customers()];
      setMaterials(m);
      setCustomers(c);
      setCustomerId(c[0]?.id ?? '');
      setLines([{ materialId: m[0]?.id ?? '', quantity: 0, rate: Number(m[0]?.defaultRate ?? 0) }]);
    })();
  }, []);

  const subTotal = lines.reduce((sum, l) => sum + l.quantity * l.rate, 0);
  const total = subTotal + Number(freight || 0);

  async function save() {
    const items = lines.filter((l) => l.materialId && l.quantity > 0);
    if (!customerId) return Alert.alert('Select a customer');
    if (!items.length) return Alert.alert('Add at least one item with quantity');
    setSaving(true);
    try {
      const custName = customers.find((c) => c.id === customerId)?.name ?? 'customer';
      const sale = await outbox.add(
        'SALE',
        { customerId, paymentMode: mode, freight: Number(freight || 0), items },
        `${custName} · ${money(total)}`,
      );
      if (gatePass) await outbox.add('GATE_PASS', {}, `Gate pass · ${custName}`, sale.clientUuid);
      if (loadingPass) await outbox.add('LOADING_PASS', {}, `Loading pass · ${custName}`, sale.clientUuid);

      if (online) {
        const r = await syncNow();
        Alert.alert('Saved', r.offline ? 'Saved offline — will sync later.' : 'Sale synced to office.');
      } else {
        Alert.alert('Saved offline', 'Sale queued — it will sync automatically when online.');
      }
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <Select
          label="Customer"
          value={customerId}
          options={customers.map((c) => ({ label: c.name, value: c.id }))}
          onChange={setCustomerId}
        />
        <Select
          label="Payment mode"
          value={mode}
          options={MODES}
          onChange={(v) => setMode(v as PaymentMode)}
        />
      </Card>

      <Card>
        <Text style={s.h}>Items</Text>
        <LineEditor materials={materials} lines={lines} onChange={setLines} />
        <Field label="Transportation charge" value={freight} onChangeText={setFreight} keyboardType="decimal-pad" />
      </Card>

      <Card>
        <View style={s.switchRow}>
          <Text style={s.swLabel}>Issue Gate Pass</Text>
          <Switch value={gatePass} onValueChange={setGatePass} trackColor={{ true: colors.primary }} />
        </View>
        <View style={s.switchRow}>
          <Text style={s.swLabel}>Issue Loading Pass</Text>
          <Switch value={loadingPass} onValueChange={setLoadingPass} trackColor={{ true: colors.primary }} />
        </View>
      </Card>

      <View style={s.totalRow}>
        <Text style={s.totalLabel}>Total</Text>
        <Text style={s.total}>{money(total)}</Text>
      </View>
      <Button title={saving ? 'Saving…' : 'Save Sale'} onPress={save} loading={saving} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  h: { fontWeight: '700', color: colors.text, marginBottom: 8 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  swLabel: { fontSize: 15, color: colors.text },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 12 },
  totalLabel: { fontSize: 16, color: colors.muted },
  total: { fontSize: 24, fontWeight: '800', color: colors.text },
});
