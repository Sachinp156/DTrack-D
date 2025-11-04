// src/navigation/Tabs.js
import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';

import DashboardScreen from '../screens/DashboardScreen';
import CamerasStack from './CamerasStack';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import AlertsScreen from '../screens/AlertsScreen';

import { useAlertStore } from '../state/useAlertStore';

const Tab = createBottomTabNavigator();

function TabIcon({ name, color, size, badge = 0 }) {
  return (
    <View style={{ width: size, height: size }}>
      <Feather name={name} color={color} size={size} />
      {badge > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: -6,
            width: 8,
            height: 8,
            borderRadius: 999,
            backgroundColor: '#f43f5e',
          }}
        />
      )}
    </View>
  );
}

export default function Tabs({ route }) {
  const pendingAlerts = useAlertStore
    ? useAlertStore((s) => (s.current ? 1 : 0) + (s.queue?.length || 0))
    : 0;

  // Allow deep-linking to a specific tab via route.params.screen
  const wanted = route?.params?.screen;
  const valid = ['Live Feed', 'Cameras', 'Analytics', 'Alerts'];
  const initialTab = valid.includes(wanted) ? wanted : 'Live Feed';

  return (
    <Tab.Navigator
      initialRouteName={initialTab}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#0F172A', borderTopColor: '#1E293B' },
        tabBarActiveTintColor: '#22d3ee',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: { fontSize: 12, marginBottom: 3 },
        tabBarHideOnKeyboard: true,
        sceneContainerStyle: { backgroundColor: '#0B1220' },
        lazy: true,
      }}
    >
      <Tab.Screen
        name="Live Feed"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => <TabIcon name="monitor" color={color} size={size} />,
        }}
      />

      {/* Cameras tab uses a Stack (list -> detail) */}
      <Tab.Screen
        name="Cameras"
        component={CamerasStack}
        options={{
          tabBarIcon: ({ color, size }) => <TabIcon name="camera" color={color} size={size} />,
        }}
      />

      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <TabIcon name="bar-chart-2" color={color} size={size} />,
        }}
      />

      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="bell" color={color} size={size} badge={pendingAlerts} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
