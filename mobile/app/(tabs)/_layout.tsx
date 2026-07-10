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
      <Tabs.Screen name="sale" options={{ headerShown: false, tabBarLabel: 'Sale' }} />
      <Tabs.Screen name="purchase" options={{ headerShown: false, tabBarLabel: 'Purchase' }} />
      <Tabs.Screen name="payment" options={{ headerShown: false, tabBarLabel: 'Payment' }} />
    </Tabs>
  );
}
