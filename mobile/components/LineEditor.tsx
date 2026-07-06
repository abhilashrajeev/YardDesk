import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Select } from './Select';
import { colors, money } from '../lib/theme';
import type { Material, Line } from '../lib/types';

export function LineEditor({
  materials,
  lines,
  onChange,
}: {
  materials: Material[];
  lines: Line[];
  onChange: (lines: Line[]) => void;
}) {
  const opts = materials.map((m) => ({ label: `${m.name} (${m.unit})`, value: m.id }));

  function update(i: number, patch: Partial<Line>) {
    const next = lines.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }
  function add() {
    onChange([...lines, { materialId: materials[0]?.id ?? '', quantity: 0, rate: 0 }]);
  }
  function remove(i: number) {
    onChange(lines.filter((_, idx) => idx !== i));
  }

  return (
    <View>
      {lines.map((l, i) => (
        <View key={i} style={s.line}>
          <Select label={`Item ${i + 1}`} value={l.materialId} options={opts} onChange={(v) => update(i, { materialId: v })} />
          <View style={s.qtyRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.lbl}>Qty</Text>
              <TextInput
                style={s.inp}
                keyboardType="decimal-pad"
                value={l.quantity ? String(l.quantity) : ''}
                onChangeText={(t) => update(i, { quantity: Number(t) || 0 })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.lbl}>Rate</Text>
              <TextInput
                style={s.inp}
                keyboardType="decimal-pad"
                value={l.rate ? String(l.rate) : ''}
                onChangeText={(t) => update(i, { rate: Number(t) || 0 })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.lbl}>Amount</Text>
              <Text style={s.amt}>{money(l.quantity * l.rate)}</Text>
            </View>
            <TouchableOpacity onPress={() => remove(i)} style={s.del}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
      <TouchableOpacity onPress={add} style={s.addBtn}>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>+ Add item</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  line: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, marginBottom: 10, backgroundColor: '#fff' },
  qtyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  lbl: { fontSize: 12, color: colors.muted, marginBottom: 3 },
  inp: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  amt: { paddingVertical: 8, fontSize: 14, fontWeight: '600', color: colors.text },
  del: { backgroundColor: '#94a3b8', borderRadius: 8, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  addBtn: { borderWidth: 1, borderColor: colors.primary, borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginBottom: 6 },
});
