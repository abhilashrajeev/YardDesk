import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import { apiError } from '../lib/api';
import { Field, Button } from '../components/ui';
import { colors } from '../lib/theme';

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');
    setLoading(true);
    try {
      await login(phone.trim(), password);
      router.replace('/(tabs)');
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={s.wrap}
    >
      <View style={s.card}>
        <Text style={s.brand}>
          Yard<Text style={{ color: colors.primary }}>ERP</Text>
        </Text>
        <Text style={s.sub}>Field app · sign in</Text>
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="9999999999" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        {!!error && <Text style={s.err}>{error}</Text>}
        <Button title="Sign in" onPress={submit} loading={loading} />
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.dark, justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 26 },
  brand: { fontSize: 26, fontWeight: '800', color: colors.text },
  sub: { color: colors.muted, marginBottom: 20, marginTop: 2 },
  err: { color: colors.red, marginBottom: 10 },
});
