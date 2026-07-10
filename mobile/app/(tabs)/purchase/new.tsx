import { useEffect, useState } from 'react';
import { ScrollView, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../../lib/api';
import { cache } from '../../../lib/masterCache';
import { outbox } from '../../../lib/outbox';
import { syncNow } from '../../../lib/sync';
import { useNetwork } from '../../../lib/net';
import { Select } from '../../../components/Select';
import { LineEditor } from '../../../components/LineEditor';
import { Field, Button, Card } from '../../../components/ui';
import { colors, money } from '../../../lib/theme';
import type { Material, Party, Vehicle, Line } from '../../../lib/types';

export default function NewPurchaseScreen() {
  const router = useRouter();
  const online = useNetwork();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [vendors, setVendors] = useState<Party[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [freight, setFreight] = useState('0');
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [m, v, veh] = [await cache.materials(), await cache.vendors(), await cache.vehicles()];
      setMaterials(m);
      setVendors(v);
      setVehicles(veh);
      setVendorId(v[0]?.id ?? '');
      setLines([{ materialId: m[0]?.id ?? '', quantity: 0, rate: 0 }]);
    })();
  }, []);

  const total = lines.reduce((sum, l) => sum + l.quantity * l.rate, 0) + Number(freight || 0);

  /** Same vehicle comes back daily — reuse it by number (case-insensitive), or register it on the fly. */
  async function resolveVehicleId(): Promise<string | undefined> {
    const num = vehicleNumber.trim();
    if (!num) return undefined;
    const existing = vehicles.find((v) => v.number.toLowerCase() === num.toLowerCase());
    if (existing) return existing.id;
    if (!online) return undefined; // can't register a brand-new vehicle while offline
    const { data } = await api.post('/vehicles', { number: num });
    return data.id;
  }

  async function save() {
    const items = lines.filter((l) => l.materialId && l.quantity > 0);
    if (!vendorId) return Alert.alert('Select a vendor');
    if (!items.length) return Alert.alert('Add at least one item with quantity');
    setSaving(true);
    try {
      const vName = vendors.find((v) => v.id === vendorId)?.name ?? 'vendor';
      const vehicleId = await resolveVehicleId();
      await outbox.add(
        'PURCHASE',
        { vendorId, vehicleId, invoiceNo: invoiceNo || undefined, freight: Number(freight || 0), items },
        `${vName} · ${money(total)}`,
      );
      if (online) {
        const r = await syncNow();
        Alert.alert('Saved', r.offline ? 'Saved offline — will sync later.' : 'Purchase synced to office.');
      } else {
        Alert.alert('Saved offline', 'Purchase queued — it will sync when online.');
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
          label="Vendor"
          value={vendorId}
          options={vendors.map((v) => ({ label: v.name, value: v.id }))}
          onChange={setVendorId}
        />
        <Field label="Vendor invoice # (optional)" value={invoiceNo} onChangeText={setInvoiceNo} />
        <Field
          label="Vehicle number (optional)"
          value={vehicleNumber}
          onChangeText={setVehicleNumber}
          placeholder="e.g. KA-05-AB-1234"
          autoCapitalize="characters"
        />
      </Card>

      <Card>
        <Text style={s.h}>Items</Text>
        <LineEditor materials={materials} lines={lines} onChange={setLines} />
        <Field label="Transportation charge" value={freight} onChangeText={setFreight} keyboardType="decimal-pad" />
      </Card>

      <Text style={s.totalLabel}>Total: <Text style={s.total}>{money(total)}</Text></Text>
      <Button title={saving ? 'Saving…' : 'Save Purchase'} onPress={save} loading={saving} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  h: { fontWeight: '700', color: colors.text, marginBottom: 8 },
  totalLabel: { fontSize: 15, color: colors.muted, marginVertical: 12 },
  total: { fontSize: 20, fontWeight: '800', color: colors.text },
});
