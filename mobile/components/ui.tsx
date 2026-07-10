import { ReactNode } from 'react';
import {
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../lib/theme';

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={s.input}
        placeholderTextColor={colors.muted}
        {...props}
      />
    </View>
  );
}

export function Button({
  title,
  onPress,
  loading,
  variant = 'primary',
  disabled,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'ghost' | 'gray';
  disabled?: boolean;
}) {
  const bg =
    variant === 'primary' ? colors.primary : variant === 'gray' ? '#475569' : 'transparent';
  return (
    <TouchableOpacity
      style={[
        s.btn,
        { backgroundColor: bg, opacity: disabled || loading ? 0.6 : 1 },
        variant === 'ghost' && { borderWidth: 1, borderColor: colors.primary },
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' ? colors.primary : '#fff'} />
      ) : (
        <Text style={[s.btnText, variant === 'ghost' && { color: colors.primary }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={s.card}>{children}</View>;
}

export function Pill({ text, color }: { text: string; color: string }) {
  return (
    <View style={[s.pill, { backgroundColor: color }]}>
      <Text style={s.pillText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 13, color: colors.muted, marginBottom: 4 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  btn: {
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  pillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
