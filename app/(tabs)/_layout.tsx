import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    index: '⛳',
    scorecard: '📋',
    stats: '📊',
    social: '👥',
  };
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>
      {icons[label] ?? '•'}
    </Text>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2d6a2d',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#e0e0e0' },
        headerStyle: { backgroundColor: '#2d6a2d' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon label="index" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="scorecard"
        options={{
          title: 'Scorecard',
          tabBarIcon: ({ focused }) => <TabIcon label="scorecard" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ focused }) => <TabIcon label="stats" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: 'Social',
          tabBarIcon: ({ focused }) => <TabIcon label="social" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
