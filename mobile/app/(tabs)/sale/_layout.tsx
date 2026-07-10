import { Stack } from 'expo-router';
import { colors } from '../../../lib/theme';

export default function SaleLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.dark },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Sales' }} />
      <Stack.Screen name="new" options={{ title: 'New Sale' }} />
      <Stack.Screen name="[id]" options={{ title: 'Sale' }} />
    </Stack>
  );
}
