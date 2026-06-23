import { Tabs } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, shadow } from '../../lib/theme';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    index: '⛳',
    social: '👥',
    events: '🗓',
    stats: '📊',
  };
  return (
    <View style={focused ? {
      shadowColor: colors.gold,
      shadowOpacity: 0.9,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 0 },
    } : undefined}>
      <Text style={{ fontSize: focused ? 24 : 20, opacity: focused ? 1 : 0.3 }}>
        {icons[label] ?? '•'}
      </Text>
    </View>
  );
}

function PlayTabButton(props: any) {
  return (
    <TouchableOpacity
      {...props}
      style={{
        top: -18,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: colors.gold,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 3,
          borderColor: colors.bgSecondary,
          ...shadow.goldGlow,
        }}
      >
        <Text style={{ fontSize: 24 }}>⛳</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.gray,
        tabBarStyle: { backgroundColor: colors.bgSecondary, borderTopColor: colors.hairline },
        tabBarLabelStyle: { fontFamily: fonts.bodySemiBold, fontSize: 11 },
        headerStyle: { backgroundColor: colors.bgSecondary },
        headerTintColor: colors.offWhite,
        headerTitleStyle: { fontFamily: fonts.bodySemiBold },
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
        name="social"
        options={{
          title: 'Clubhouse',
          tabBarIcon: ({ focused }) => <TabIcon label="social" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="scorecard"
        options={{
          title: 'Play',
          tabBarLabel: () => null,
          tabBarButton: PlayTabButton,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarIcon: ({ focused }) => <TabIcon label="events" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ focused }) => <TabIcon label="stats" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
