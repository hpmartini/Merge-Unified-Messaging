import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import { useNetworkStatus } from './src/hooks/useNetworkStatus';
import { useWebSocket } from './src/hooks/useWebSocket';

function LifecycleManager() {
  useNetworkStatus();
  useWebSocket();
  return null;
}

export default function App() {
  return (
    <NavigationContainer>
      <LifecycleManager />
      <AppNavigator />
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}
