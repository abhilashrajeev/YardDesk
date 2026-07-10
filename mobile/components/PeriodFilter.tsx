import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { colors } from '../lib/theme';

export type PeriodView = 'recent' | 'day' | 'month' | 'custom';

export interface PeriodState {
  view: PeriodView;
  day: string;
  month: string;
  customFrom: string;
  customTo: string;
}

function today() {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}
function monthStart(monthStr: string) {
  return `${monthStr}-01`;
}
function monthEnd(monthStr: string) {
  const [y, m] = monthStr.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${monthStr}-${String(last).padStart(2, '0')}`;
}
function currentMonth() {
  return today().slice(0, 7);
}
function shiftDay(dateStr: string, delta: number) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}
function shiftMonth(monthStr: string, delta: number) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function defaultPeriodState(): PeriodState {
  return {
    view: 'recent',
    day: today(),
    month: currentMonth(),
    customFrom: monthStart(currentMonth()),
    customTo: today(),
  };
}

export function periodRange(state: PeriodState): { from?: string; to?: string } {
  if (state.view === 'recent') return {};
  if (state.view === 'day') return { from: state.day, to: state.day };
  if (state.view === 'month') return { from: monthStart(state.month), to: monthEnd(state.month) };
  return { from: state.customFrom, to: state.customTo };
}

export function periodLabel(state: PeriodState): string {
  if (state.view === 'recent') return 'Recent';
  if (state.view === 'day') return state.day === today() ? 'Today' : state.day;
  if (state.view === 'month') return state.month;
  return `${state.customFrom} → ${state.customTo}`;
}

const TABS: { key: PeriodView; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: 'day', label: 'Daily' },
  { key: 'month', label: 'Monthly' },
  { key: 'custom', label: 'Custom' },
];

export function PeriodFilter({
  value,
  onChange,
  allowRecent = true,
}: {
  value: PeriodState;
  onChange: (next: PeriodState) => void;
  allowRecent?: boolean;
}) {
  const tabs = allowRecent ? TABS : TABS.filter((t) => t.key !== 'recent');
  return (
    <View>
      <View style={s.row}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[s.tab, value.view === t.key && s.tabActive]}
            onPress={() => onChange({ ...value, view: t.key })}
          >
            <Text style={[s.tabText, value.view === t.key && s.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {value.view === 'day' && (
        <View style={s.stepRow}>
          <TouchableOpacity style={s.stepBtn} onPress={() => onChange({ ...value, day: shiftDay(value.day, -1) })}>
            <Text style={s.stepBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={s.stepValue}>{value.day}</Text>
          <TouchableOpacity style={s.stepBtn} onPress={() => onChange({ ...value, day: shiftDay(value.day, 1) })}>
            <Text style={s.stepBtnText}>›</Text>
          </TouchableOpacity>
        </View>
      )}
      {value.view === 'month' && (
        <View style={s.stepRow}>
          <TouchableOpacity style={s.stepBtn} onPress={() => onChange({ ...value, month: shiftMonth(value.month, -1) })}>
            <Text style={s.stepBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={s.stepValue}>{value.month}</Text>
          <TouchableOpacity style={s.stepBtn} onPress={() => onChange({ ...value, month: shiftMonth(value.month, 1) })}>
            <Text style={s.stepBtnText}>›</Text>
          </TouchableOpacity>
        </View>
      )}
      {value.view === 'custom' && (
        <View style={s.customRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.customLabel}>From (YYYY-MM-DD)</Text>
            <TextInput
              style={s.customInput}
              value={value.customFrom}
              onChangeText={(t) => onChange({ ...value, customFrom: t })}
              placeholder="2026-07-01"
              placeholderTextColor={colors.muted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.customLabel}>To (YYYY-MM-DD)</Text>
            <TextInput
              style={s.customInput}
              value={value.customTo}
              onChangeText={(t) => onChange({ ...value, customTo: t })}
              placeholder="2026-07-09"
              placeholderTextColor={colors.muted}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 12.5, color: colors.text, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 18, color: colors.primary, fontWeight: '700' },
  stepValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  customRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  customLabel: { fontSize: 11, color: colors.muted, marginBottom: 3 },
  customInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    backgroundColor: '#fff',
    color: colors.text,
  },
});
