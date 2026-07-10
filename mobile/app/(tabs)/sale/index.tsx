import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { api, apiError } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { PeriodFilter, defaultPeriodState, periodRange, periodLabel, type PeriodState } from '../../../components/PeriodFilter';
import { Button, Pill } from '../../../components/ui';
import { colors, money, fmtDate, statusColor } from '../../../lib/theme';
import type { Sale } from '../../../lib/types';

export default function SalesList() {
  const router = useRouter();
  const { user } = useAuth();
  const canCreate = user?.role === 'SUPER_ADMIN' || !!user?.permissions.includes('SALES');
  const [period, setPeriod] = useState<PeriodState>(defaultPeriodState());
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { from, to } = periodRange(period);
      const query = from ? `?from=${from}&to=${to}` : '';
      const { data } = await api.get<Sale[]>(`/sales${query}`);
      setSales(data);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const active = sales?.filter((s) => s.status !== 'CANCELLED') ?? [];
  const total = active.reduce((sum, s) => sum + Number(s.total), 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={s.header}>
        <PeriodFilter value={period} onChange={setPeriod} />
        <View style={s.summaryRow}>
          <Text style={s.summary}>{active.length} bill{active.length === 1 ? '' : 's'} · {periodLabel(period)}</Text>
          <Text style={s.summaryTotal}>{money(total)}</Text>
        </View>
        {canCreate && (
          <Button title="+ New Sale" onPress={() => router.push('/(tabs)/sale/new')} />
        )}
      </View>

      {!!error && <Text style={s.err}>{error}</Text>}

      <FlatList
        data={sales ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={!loading ? <Text style={s.empty}>No sales for this period.</Text> : null}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.row} onPress={() => router.push(`/(tabs)/sale/${item.id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={s.billNo}>Bill #{item.billNo}</Text>
              <Text style={s.customer}>{item.customer?.name}</Text>
              <Text style={s.date}>{fmtDate(item.date)} · {item.paymentMode}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.amount}>{money(item.total)}</Text>
              <Pill
                text={item.status === 'CANCELLED' ? 'CANCELLED' : (item.paymentStatus ?? '')}
                color={item.status === 'CANCELLED' ? colors.red : statusColor(item.paymentStatus)}
              />
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
  billNo: { fontWeight: '700', color: colors.text, fontSize: 14 },
  customer: { color: colors.text, fontSize: 13, marginTop: 2 },
  date: { color: colors.muted, fontSize: 12, marginTop: 2 },
  amount: { fontWeight: '700', color: colors.text, fontSize: 14, marginBottom: 4 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 24 },
  err: { color: colors.red, textAlign: 'center', marginTop: 8 },
});
