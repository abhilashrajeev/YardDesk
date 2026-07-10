import { Stack } from 'expo-router';
import { colors } from '../../../lib/theme';

export default function PaymentLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.dark },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Payments' }} />
      <Stack.Screen name="new" options={{ title: 'New Payment' }} />
      <Stack.Screen name="[id]" options={{ title: 'Payment' }} />
    </Stack>
  );
}
