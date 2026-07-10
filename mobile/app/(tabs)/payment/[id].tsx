import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, apiError } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { Select } from '../../../components/Select';
import { Field, Button, Card, Pill } from '../../../components/ui';
import { colors, money, fmtDate } from '../../../lib/theme';
import type { Payment, PaymentMode } from '../../../lib/types';

const MODES: { label: string; value: PaymentMode }[] = [
  { label: 'Cash', value: 'CASH' },
  { label: 'UPI', value: 'UPI' },
  { label: 'Bank', value: 'BANK' },
];

export default function PaymentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [mode, setMode] = useState<PaymentMode>('CASH');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.get<Payment>(`/accounts/payments/${id}`);
      setPayment(data);
    } catch (e) {
      setError(apiError(e));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit() {
    if (!payment) return;
    setMode(payment.mode);
    setAmount(String(Number(payment.amount)));
    setReference(payment.reference ?? '');
    setEditing(true);
  }

  async function saveEdit() {
    const amt = Number(amount || 0);
    if (amt <= 0) return Alert.alert('Enter an amount');
    setSaving(true);
    try {
      await api.patch(`/accounts/payments/${id}`, {
        mode,
        amount: amt,
        reference: reference || undefined,
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
    Alert.alert('Delete (void) this payment?', 'Its ledger effect will be reversed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/accounts/payments/${id}`);
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
  if (!payment) {
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
          <Select label="Mode" value={mode} options={MODES} onChange={(v) => setMode(v as PaymentMode)} />
          <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          <Field label="Reference (optional)" value={reference} onChangeText={setReference} />
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
          <Text style={s.party}>{payment.customer?.name ?? payment.vendor?.name}</Text>
          {payment.voided && <Pill text="VOIDED" color={colors.red} />}
        </View>
        <Text style={s.muted}>{fmtDate(payment.date)}</Text>
      </Card>

      <Card>
        <View style={s.between}><Text style={s.muted}>Direction</Text><Text>{payment.direction === 'IN' ? 'Money in (Customer)' : 'Money out (Vendor)'}</Text></View>
        <View style={s.between}><Text style={s.muted}>Mode</Text><Text>{payment.mode}</Text></View>
        <View style={s.between}><Text style={s.muted}>Reference</Text><Text>{payment.reference || '—'}</Text></View>
        <View style={[s.between, s.totalDivider]}>
          <Text style={s.totalLabel}>Amount</Text>
          <Text style={[s.totalValue, { color: payment.direction === 'IN' ? colors.green : colors.red }]}>
            {payment.direction === 'IN' ? '+' : '-'}{money(payment.amount)}
          </Text>
        </View>
      </Card>

      {isAdmin && !payment.voided && (
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
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  party: { fontSize: 17, fontWeight: '800', color: colors.text },
  muted: { color: colors.muted, fontSize: 13, marginTop: 6 },
  between: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalDivider: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: 8 },
  totalLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  totalValue: { fontSize: 15, fontWeight: '800' },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 24 },
  err: { color: colors.red },
});
