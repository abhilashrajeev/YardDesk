import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { api, apiError } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { PeriodFilter, defaultPeriodState, periodRange, periodLabel, type PeriodState } from '../../../components/PeriodFilter';
import { Button, Pill } from '../../../components/ui';
import { colors, money, fmtDate } from '../../../lib/theme';
import type { Payment } from '../../../lib/types';

export default function PaymentsList() {
  const router = useRouter();
  const { user } = useAuth();
  const canCreate = user?.role === 'SUPER_ADMIN' || !!user?.permissions.includes('PAYMENTS');
  const [period, setPeriod] = useState<PeriodState>(defaultPeriodState());
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { from, to } = periodRange(period);
      const query = from ? `?from=${from}&to=${to}` : '';
      const { data } = await api.get<Payment[]>(`/accounts/payments${query}`);
      setPayments(data);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const active = payments?.filter((p) => !p.voided) ?? [];
  const totalIn = active.filter((p) => p.direction === 'IN').reduce((sum, p) => sum + Number(p.amount), 0);
  const totalOut = active.filter((p) => p.direction === 'OUT').reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={s.header}>
        <PeriodFilter value={period} onChange={setPeriod} />
        <View style={s.summaryRow}>
          <Text style={s.summary}>{active.length} entr{active.length === 1 ? 'y' : 'ies'} · {periodLabel(period)}</Text>
          <Text style={s.summaryTotal}>+{money(totalIn)} / -{money(totalOut)}</Text>
        </View>
        {canCreate && <Button title="+ New Payment" onPress={() => router.push('/(tabs)/payment/new')} />}
      </View>

      {!!error && <Text style={s.err}>{error}</Text>}

      <FlatList
        data={payments ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={!loading ? <Text style={s.empty}>No payments for this period.</Text> : null}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[s.row, item.voided && { opacity: 0.5 }]}
            onPress={() => router.push(`/(tabs)/payment/${item.id}`)}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.party}>{item.customer?.name ?? item.vendor?.name}</Text>
              <Text style={s.date}>{fmtDate(item.date)} · {item.mode}{item.reference ? ` · ${item.reference}` : ''}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[s.amount, { color: item.direction === 'IN' ? colors.green : colors.red }]}>
                {item.direction === 'IN' ? '+' : '-'}{money(item.amount)}
              </Text>
              {item.voided && <Pill text="VOIDED" color={colors.red} />}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  header: { padding: 16, paddingBottom: 8, backgroundColor: colors.panel, borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summary: { color: colors.muted, fontSize: 13 },
  summaryTotal: { color: colors.text, fontWeight: '700', fontSize: 13 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  party: { fontWeight: '700', color: colors.text, fontSize: 14 },
  date: { color: colors.muted, fontSize: 12, marginTop: 2 },
  amount: { fontWeight: '700', fontSize: 14, marginBottom: 4 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 24 },
  err: { color: colors.red, textAlign: 'center', marginTop: 8 },
});
