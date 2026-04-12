import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ListRenderItem } from 'react-native';
import type { RootStackScreenProps } from '../navigation/types';
import { MessageBubble, Message } from '../components/MessageBubble';

export default function ChatScreen({ route }: RootStackScreenProps<'Chat'>) {
  const { chatId, name } = route.params;
  
  const [messages, setMessages] = useState<Message[]>([
    { id: '2', text: 'Hello! How are you?', isOutgoing: true, timestamp: '10:01 AM', status: 'read' },
    { id: '1', text: `Hi there! I'm ${name}`, isOutgoing: false, timestamp: '10:00 AM' },
  ]);
  const [inputText, setInputText] = useState('');

  const sendMessage = () => {
    if (inputText.trim() === '') return;
    
    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isOutgoing: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sent',
    };
    
    setMessages((prev) => [newMessage, ...prev]);
    setInputText('');
  };

  const renderItem: ListRenderItem<Message> = useCallback(
    ({ item }) => <MessageBubble message={item} />,
    []
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        data={messages}
        inverted
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        testID="chat-list"
      />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          testID="message-input"
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage} testID="send-button">
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  listContent: {
    padding: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#FFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#C6C6C8',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
