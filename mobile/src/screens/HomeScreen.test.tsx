import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import HomeScreen from './HomeScreen';

const mockNavigate = jest.fn();
const mockNavigation: any = {
  navigate: mockNavigate,
};

describe('HomeScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders a list of chats', () => {
    const { getByTestId, getByText } = render(<HomeScreen navigation={mockNavigation} route={{} as any} />);
    
    expect(getByTestId('chat-list')).toBeTruthy();
    expect(getByText('Alice')).toBeTruthy();
    expect(getByText('Hey, are we still on for today?')).toBeTruthy();
    expect(getByText('Bob')).toBeTruthy();
    expect(getByText('Charlie')).toBeTruthy();
  });

  it('navigates to Chat screen on press', () => {
    const { getByTestId } = render(<HomeScreen navigation={mockNavigation} route={{} as any} />);
    
    const aliceChatItem = getByTestId('chat-item-1');
    fireEvent.press(aliceChatItem);
    
    expect(mockNavigate).toHaveBeenCalledWith('Chat', { chatId: '1', name: 'Alice' });
  });

  it('renders unread badges when unreadCount > 0', () => {
    const { getByText, queryByText } = render(<HomeScreen navigation={mockNavigation} route={{} as any} />);
    
    // Alice has 2
    expect(getByText('2')).toBeTruthy();
    // Charlie has 5
    expect(getByText('5')).toBeTruthy();
    // Bob has 0 (should not render a badge)
    expect(queryByText('0')).toBeNull();
  });
});
