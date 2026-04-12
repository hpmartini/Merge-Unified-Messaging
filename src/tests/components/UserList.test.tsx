import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UserList } from '../../components/SidebarComponents/UserList';

describe('UserList Component', () => {
  const mockUsers = [
    {
      id: '1',
      name: 'Alice',
      platform: 'WhatsApp',
      unreadCount: 0,
      status: 'online',
      lastMessage: 'Hi',
      lastMessageTime: new Date(),
      platforms: ['WhatsApp'],
      activePlatforms: ['WhatsApp']
    },
    {
      id: '2',
      name: 'Bob',
      platform: 'Telegram',
      unreadCount: 2,
      status: 'offline',
      lastMessage: 'Hello',
      lastMessageTime: new Date(Date.now() - 86400000), // Yesterday
      platforms: ['Telegram'],
      activePlatforms: ['Telegram']
    }
  ] as any;

  it('renders users', () => {
    render(<UserList users={mockUsers} selectedUser={null} onSelectUser={() => {}} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('calls onSelectUser when a user is clicked', () => {
    const handleSelect = vi.fn();
    render(<UserList users={mockUsers} selectedUser={null} onSelectUser={handleSelect} />);
    fireEvent.click(screen.getByText('Alice'));
    expect(handleSelect).toHaveBeenCalledWith(mockUsers[0]);
  });
});
