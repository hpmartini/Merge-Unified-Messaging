import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import type { RootStackScreenProps } from '../navigation/types';

export default function HomeScreen({ navigation }: RootStackScreenProps<'Home'>) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inbox</Text>
      <Button 
        title="Go to Chat" 
        onPress={() => navigation.navigate('Chat', { id: '1', name: 'Alice' })} 
      />
      <Button 
        title="Go to Settings" 
        onPress={() => navigation.navigate('Settings')} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
  },
});
