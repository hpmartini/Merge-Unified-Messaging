import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import type { RootStackScreenProps } from '../navigation/types';

interface ChatItem {
  id: string;
  name: string;
  lastMessage: string;
  unreadCount: number;
  avatar: string;
}

const mockChats: ChatItem[] = [
  { id: '1', name: 'Alice', lastMessage: 'Hey, are we still on for today?', unreadCount: 2, avatar: 'https://i.pravatar.cc/150?u=alice' },
  { id: '2', name: 'Bob', lastMessage: 'Sent an attachment', unreadCount: 0, avatar: 'https://i.pravatar.cc/150?u=bob' },
  { id: '3', name: 'Charlie', lastMessage: 'Thanks!', unreadCount: 5, avatar: 'https://i.pravatar.cc/150?u=charlie' },
];

export default function HomeScreen({ navigation }: RootStackScreenProps<'Home'>) {
  const renderItem = ({ item }: { item: ChatItem }) => (
    <TouchableOpacity 
      style={styles.chatItem}
      onPress={() => navigation.navigate('Chat', { chatId: item.id, name: item.name })}
      testID={`chat-item-${item.id}`}
    >
      <Image source={{ uri: item.avatar }} style={styles.avatar} testID={`avatar-${item.id}`} />
      <View style={styles.chatInfo}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage}</Text>
      </View>
      {item.unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{item.unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={mockChats}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        testID="chat-list"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  listContent: {
    paddingVertical: 8,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 16,
    backgroundColor: '#ccc',
  },
  chatInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  unreadBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
