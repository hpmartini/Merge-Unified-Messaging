import React from 'react';
import { render, screen } from '@testing-library/react';
import Sidebar from '../components/Sidebar';
import { useAppStore } from '../store/useAppStore';
import { describe, it, expect, beforeEach } from 'vitest';

describe('Sidebar Component', () => {
  beforeEach(() => {
    // Reset state
    const state = useAppStore.getState();
    state.setUsers([
      {
        id: '1',
        name: 'John Doe',
        platform: 'WhatsApp',
        unreadCount: 0,
        status: 'online',
        lastMessage: 'Hello',
        lastMessageTime: new Date(),
        platforms: ['WhatsApp'],
        activePlatforms: ['WhatsApp']
      }
    ] as any);
  });

  it('renders correctly', () => {
    render(<Sidebar />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });
});
