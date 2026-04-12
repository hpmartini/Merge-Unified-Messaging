import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { RootStackScreenProps } from '../navigation/types';

export default function ChatScreen({ route }: RootStackScreenProps<'Chat'>) {
  const { name } = route.params;
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chat with {name}</Text>
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
  },
});
