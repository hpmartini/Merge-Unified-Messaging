import React from 'react';
import { render } from '@testing-library/react-native';
import { MessageBubble } from '../MessageBubble';

describe('MessageBubble', () => {
  it('renders incoming message correctly', () => {
    const { getByText, queryByTestId } = render(
      <MessageBubble
        message={{
          id: '1',
          text: 'Hello',
          isOutgoing: false,
          timestamp: '10:00 AM',
        }}
      />
    );

    expect(getByText('Hello')).toBeTruthy();
    expect(getByText('10:00 AM')).toBeTruthy();
    // Incoming messages should not have a status indicator
    expect(queryByTestId('message-status-1')).toBeNull();
  });

  it('renders outgoing message with status correctly', () => {
    const { getByText } = render(
      <MessageBubble
        message={{
          id: '2',
          text: 'Hi',
          isOutgoing: true,
          timestamp: '10:05 AM',
          status: 'read',
        }}
      />
    );

    expect(getByText('Hi')).toBeTruthy();
    expect(getByText('10:05 AM')).toBeTruthy();
    // 'read' status maps to '✓✓'
    expect(getByText('✓✓')).toBeTruthy();
  });
});
