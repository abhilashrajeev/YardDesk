import { Stack } from 'expo-router';
import { colors } from '../../../lib/theme';

export default function PurchaseLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.dark },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Purchases' }} />
      <Stack.Screen name="new" options={{ title: 'New Purchase' }} />
      <Stack.Screen name="[id]" options={{ title: 'Purchase' }} />
    </Stack>
  );
}
