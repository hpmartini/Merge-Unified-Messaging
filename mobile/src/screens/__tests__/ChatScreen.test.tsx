import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ChatScreen from '../ChatScreen';

describe('ChatScreen', () => {
  const mockRoute = {
    params: {
      chatId: '123',
      name: 'Alice',
    },
  } as any;

  it('renders initial messages and input field', () => {
    const { getByText, getByTestId } = render(<ChatScreen route={mockRoute} navigation={{} as any} />);

    // Initial messages
    expect(getByText("Hi there! I'm Alice")).toBeTruthy();
    expect(getByText('Hello! How are you?')).toBeTruthy();
    
    // Input field and button
    expect(getByTestId('message-input')).toBeTruthy();
    expect(getByTestId('send-button')).toBeTruthy();
  });

  it('adds a new message when send button is pressed', () => {
    const { getByTestId, getByText } = render(<ChatScreen route={mockRoute} navigation={{} as any} />);

    const input = getByTestId('message-input');
    const sendButton = getByTestId('send-button');

    fireEvent.changeText(input, 'New test message');
    fireEvent.press(sendButton);

    expect(getByText('New test message')).toBeTruthy();
  });
});
