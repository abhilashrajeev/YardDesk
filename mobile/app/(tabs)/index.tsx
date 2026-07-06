import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { useNetwork } from '../../lib/net';
import { outbox } from '../../lib/outbox';
import { syncNow } from '../../lib/sync';
import { Button, Card } from '../../components/ui';
import { colors } from '../../lib/theme';
import type { OutboxItem } from '../../lib/types';

export default function Home() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const online = useNetwork();
  const [pending, setPending] = useState<OutboxItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState('');

  const refresh = useCallback(async () => {
    setPending(await outbox.all());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-sync when connectivity returns and there is a backlog.
  useEffect(() => {
    if (online) doSync(true);
    // eslint-disable-next-line
  }, [online]);

  async function doSync(silent = false) {
    if (syncing) return;
    setSyncing(true);
    if (!silent) setMsg('');
    try {
      const r = await syncNow();
      await refresh();
      if (r.offline) setMsg('Offline — will sync when back online.');
      else setMsg(`Synced ${r.synced}, ${r.remaining} pending${r.failed ? `, ${r.failed} failed` : ''}.`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={syncing} onRefresh={() => doSync(false)} />}
    >
      <View style={[s.banner, { backgroundColor: online ? colors.green : colors.red }]}>
        <Text style={s.bannerText}>{online ? '● Online' : '● Offline — entries saved locally'}</Text>
      </View>

      <Card>
        <Text style={s.hi}>Hi, {user?.name}</Text>
        <Text style={s.role}>{user?.role.replace('_', ' ')}</Text>
      </Card>

      <Card>
        <View style={s.row}>
          <View>
            <Text style={s.big}>{pending.length}</Text>
            <Text style={s.muted}>pending to sync</Text>
          </View>
          <View style={{ width: 130 }}>
            <Button title={syncing ? 'Syncing…' : 'Sync now'} onPress={() => doSync(false)} loading={syncing} disabled={!online} />
          </View>
        </View>
        {!!msg && <Text style={[s.muted, { marginTop: 10 }]}>{msg}</Text>}
      </Card>

      {pending.length > 0 && (
        <Card>
          <Text style={s.section}>Pending entries</Text>
          {pending.map((p) => (
            <View key={p.clientUuid} style={s.pendRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.pendTitle}>
                  {p.kind.replace('_', ' ')} · {p.summary}
                </Text>
                {!!p.error && <Text style={s.err}>{p.error}</Text>}
              </View>
              <Text style={s.clock}>⏳</Text>
            </View>
          ))}
        </Card>
      )}

      <View style={{ marginTop: 8 }}>
        <Button
          title="Logout"
          variant="gray"
          onPress={async () => {
            await logout();
            router.replace('/login');
          }}
        />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  banner: { borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginBottom: 12 },
  bannerText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  hi: { fontSize: 18, fontWeight: '700', color: colors.text },
  role: { color: colors.muted, marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  big: { fontSize: 32, fontWeight: '800', color: colors.primary },
  muted: { color: colors.muted },
  section: { fontWeight: '700', color: colors.text, marginBottom: 8 },
  pendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  pendTitle: { color: colors.text, fontSize: 14 },
  err: { color: colors.red, fontSize: 12, marginTop: 2 },
  clock: { fontSize: 16 },
});
