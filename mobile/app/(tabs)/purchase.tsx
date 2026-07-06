import { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Alert } from 'react-native';
import { cache } from '../../lib/masterCache';
import { outbox } from '../../lib/outbox';
import { syncNow } from '../../lib/sync';
import { useNetwork } from '../../lib/net';
import { Select } from '../../components/Select';
import { LineEditor } from '../../components/LineEditor';
import { Field, Button, Card } from '../../components/ui';
import { colors, money } from '../../lib/theme';
import type { Material, Party, Line } from '../../lib/types';

export default function PurchaseScreen() {
  const online = useNetwork();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [vendors, setVendors] = useState<Party[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [freight, setFreight] = useState('0');
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [m, v] = [await cache.materials(), await cache.vendors()];
      setMaterials(m);
      setVendors(v);
      setVendorId(v[0]?.id ?? '');
      setLines([{ materialId: m[0]?.id ?? '', quantity: 0, rate: 0 }]);
    })();
  }, []);

  const total = lines.reduce((sum, l) => sum + l.quantity * l.rate, 0) + Number(freight || 0);

  async function save() {
    const items = lines.filter((l) => l.materialId && l.quantity > 0);
    if (!vendorId) return Alert.alert('Select a vendor');
    if (!items.length) return Alert.alert('Add at least one item with quantity');
    setSaving(true);
    try {
      const vName = vendors.find((v) => v.id === vendorId)?.name ?? 'vendor';
      await outbox.add(
        'PURCHASE',
        { vendorId, invoiceNo: invoiceNo || undefined, freight: Number(freight || 0), items },
        `${vName} · ${money(total)}`,
      );
      setLines([{ materialId: materials[0]?.id ?? '', quantity: 0, rate: 0 }]);
      setInvoiceNo('');
      setFreight('0');
      if (online) {
        const r = await syncNow();
        Alert.alert('Saved', r.offline ? 'Saved offline — will sync later.' : 'Purchase synced to office.');
      } else {
        Alert.alert('Saved offline', 'Purchase queued — it will sync when online.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <Select
          label="Vendor"
          value={vendorId}
          options={vendors.map((v) => ({ label: v.name, value: v.id }))}
          onChange={setVendorId}
        />
        <Field label="Vendor invoice # (optional)" value={invoiceNo} onChangeText={setInvoiceNo} />
      </Card>

      <Card>
        <Text style={s.h}>Items</Text>
        <LineEditor materials={materials} lines={lines} onChange={setLines} />
        <Field label="Freight" value={freight} onChangeText={setFreight} keyboardType="decimal-pad" />
      </Card>

      <View style={s.totalRow}>
        <Text style={s.totalLabel}>Total</Text>
        <Text style={s.total}>{money(total)}</Text>
      </View>
      <Button title={saving ? 'Saving…' : 'Save Purchase'} onPress={save} loading={saving} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  h: { fontWeight: '700', color: colors.text, marginBottom: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 12 },
  totalLabel: { fontSize: 16, color: colors.muted },
  total: { fontSize: 24, fontWeight: '800', color: colors.text },
});
