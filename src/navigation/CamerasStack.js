// src/navigation/CamerasStack.js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LiveCamsScreen from '../screens/LiveCamsScreen';
import CameraDetailScreen from '../screens/CameraDetailScreen';

const Stack = createNativeStackNavigator();

export default function CamerasStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0B1220' },
        headerTintColor: '#e2e8f0',
        headerTitleStyle: { fontWeight: '800' },
        contentStyle: { backgroundColor: '#0B1220' },
      }}
    >
      <Stack.Screen name="LiveCams" component={LiveCamsScreen} options={{ title: 'Live Cameras' }} />
      <Stack.Screen name="CameraDetail" component={CameraDetailScreen} options={{ title: 'Camera' }} />
    </Stack.Navigator>
  );
}
