import { Tabs } from 'expo-router';
import { colors } from '../../lib/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.dark },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Yard ERP', tabBarLabel: 'Home' }} />
      <Tabs.Screen name="sale" options={{ title: 'New Sale', tabBarLabel: 'Sale' }} />
      <Tabs.Screen name="purchase" options={{ title: 'New Purchase', tabBarLabel: 'Purchase' }} />
      <Tabs.Screen name="payment" options={{ title: 'Payment', tabBarLabel: 'Payment' }} />
    </Tabs>
  );
}
