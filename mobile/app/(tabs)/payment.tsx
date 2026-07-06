import { useEffect, useState } from 'react';
import { ScrollView, Alert } from 'react-native';
import { cache } from '../../lib/masterCache';
import { outbox } from '../../lib/outbox';
import { syncNow } from '../../lib/sync';
import { useNetwork } from '../../lib/net';
import { Select } from '../../components/Select';
import { Field, Button, Card } from '../../components/ui';
import { colors, money } from '../../lib/theme';
import type { Party, PaymentMode } from '../../lib/types';

const MODES: { label: string; value: PaymentMode }[] = [
  { label: 'Cash', value: 'CASH' },
  { label: 'UPI', value: 'UPI' },
  { label: 'Bank', value: 'BANK' },
];

export default function PaymentScreen() {
  const online = useNetwork();
  const [partyType, setPartyType] = useState<'CUSTOMER' | 'VENDOR'>('CUSTOMER');
  const [customers, setCustomers] = useState<Party[]>([]);
  const [vendors, setVendors] = useState<Party[]>([]);
  const [partyId, setPartyId] = useState('');
  const [mode, setMode] = useState<PaymentMode>('CASH');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setCustomers(await cache.customers());
      setVendors(await cache.vendors());
    })();
  }, []);

  const parties = partyType === 'CUSTOMER' ? customers : vendors;

  useEffect(() => {
    setPartyId(parties[0]?.id ?? '');
    // eslint-disable-next-line
  }, [partyType, customers, vendors]);

  async function save() {
    const amt = Number(amount || 0);
    if (!partyId) return Alert.alert('Select a party');
    if (amt <= 0) return Alert.alert('Enter an amount');
    setSaving(true);
    try {
      const name = parties.find((p) => p.id === partyId)?.name ?? '';
      await outbox.add(
        'PAYMENT',
        {
          partyType,
          customerId: partyType === 'CUSTOMER' ? partyId : undefined,
          vendorId: partyType === 'VENDOR' ? partyId : undefined,
          direction: partyType === 'CUSTOMER' ? 'IN' : 'OUT',
          mode,
          amount: amt,
          reference: reference || undefined,
        },
        `${name} · ${money(amt)}`,
      );
      setAmount('');
      setReference('');
      if (online) {
        const r = await syncNow();
        Alert.alert('Saved', r.offline ? 'Saved offline — will sync later.' : 'Payment synced to office.');
      } else {
        Alert.alert('Saved offline', 'Payment queued — it will sync when online.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <Select
          label="Party type"
          value={partyType}
          options={[
            { label: 'Customer (money in)', value: 'CUSTOMER' },
            { label: 'Vendor (money out)', value: 'VENDOR' },
          ]}
          onChange={(v) => setPartyType(v as 'CUSTOMER' | 'VENDOR')}
        />
        <Select
          label={partyType === 'CUSTOMER' ? 'Customer' : 'Vendor'}
          value={partyId}
          options={parties.map((p) => ({ label: p.name, value: p.id }))}
          onChange={setPartyId}
        />
        <Select label="Mode" value={mode} options={MODES} onChange={(v) => setMode(v as PaymentMode)} />
        <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Field label="Reference (optional)" value={reference} onChangeText={setReference} />
      </Card>
      <Button title={saving ? 'Saving…' : 'Save Payment'} onPress={save} loading={saving} />
    </ScrollView>
  );
}
