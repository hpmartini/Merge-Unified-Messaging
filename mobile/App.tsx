import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import { useNetworkStatus } from './src/hooks/useNetworkStatus';

function NetworkManager() {
  useNetworkStatus();
  return null;
}

export default function App() {
  return (
    <NavigationContainer>
      <NetworkManager />
      <AppNavigator />
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}
