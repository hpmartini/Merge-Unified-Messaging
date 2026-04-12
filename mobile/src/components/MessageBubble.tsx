import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface Message {
  id: string;
  text: string;
  isOutgoing: boolean;
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read';
}

interface Props {
  message: Message;
}

export const MessageBubble: React.FC<Props> = ({ message }) => {
  const { text, isOutgoing, timestamp, status } = message;

  return (
    <View
      testID={`message-bubble-${message.id}`}
      style={[
        styles.container,
        isOutgoing ? styles.outgoingContainer : styles.incomingContainer,
      ]}
    >
      <Text style={[styles.text, isOutgoing ? styles.outgoingText : styles.incomingText]}>
        {text}
      </Text>
      <View style={styles.footer}>
        <Text style={[styles.timestamp, isOutgoing ? styles.outgoingTimestamp : styles.incomingTimestamp]}>
          {timestamp}
        </Text>
        {isOutgoing && status && (
          <Text style={styles.status} testID={`message-status-${message.id}`}>
            {status === 'read' ? '✓✓' : status === 'delivered' ? '✓' : '•'}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: '80%',
    marginVertical: 4,
    padding: 10,
    borderRadius: 8,
  },
  incomingContainer: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E5EA',
    borderBottomLeftRadius: 2,
  },
  outgoingContainer: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 2,
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
  },
  incomingText: {
    color: '#000',
  },
  outgoingText: {
    color: '#FFF',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 11,
  },
  incomingTimestamp: {
    color: '#666',
  },
  outgoingTimestamp: {
    color: '#E5E5EA',
  },
  status: {
    fontSize: 11,
    color: '#E5E5EA',
    marginLeft: 4,
  },
});
