import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatArea } from '../src/components/ChatArea';
import { useAppStore } from '../src/store/useAppStore';

// Mock the AppStore
vi.mock('../src/store/useAppStore', () => ({
  useAppStore: vi.fn(),
}));

describe('ChatArea Typing Indicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders typing indicator when selected user is typing', () => {
    (useAppStore as any).mockReturnValue({
      selectedUser: { id: 'u1', name: 'User 1', activePlatforms: ['Telegram'] },
      typingUsers: { 'u1': true },
      messages: [],
      setMessages: vi.fn(),
      setUsers: vi.fn(),
      visiblePlatforms: new Set(),
      setVisiblePlatforms: vi.fn(),
      targetMessageId: null,
      setTargetMessageId: vi.fn(), setReplyingTo: vi.fn(), setIsGalleryOpen: vi.fn(), setActivePDF: vi.fn(), setLightboxImage: vi.fn(), setDraftAttachments: vi.fn(),
      setSummary: vi.fn(),
      globalSearchQuery: '', draftAttachments: [],
    });

    const { container } = render(
      <ChatArea 
        whatsapp={{ status: 'disconnected', user: null, qrCode: null, linkUri: null }}
        signal={{ status: 'disconnected', user: null, qrCode: null, linkUri: null }}
        telegram={{ status: 'disconnected', user: null, qrCode: null, linkUri: null }}
        email={{ status: 'disconnected', user: null, qrCode: null, linkUri: null }}
        slack={{ status: 'disconnected', user: null, qrCode: null, linkUri: null }}
      />
    );

    // Typing indicator has animate-bounce elements
    const bouncyDots = container.querySelectorAll('.animate-bounce');
    expect(bouncyDots.length).toBe(3);
  });

  it('does not render typing indicator when selected user is not typing', () => {
    (useAppStore as any).mockReturnValue({
      selectedUser: { id: 'u1', name: 'User 1', activePlatforms: ['Telegram'] },
      typingUsers: { 'u1': false, 'u2': true },
      messages: [],
      setMessages: vi.fn(),
      setUsers: vi.fn(),
      visiblePlatforms: new Set(),
      setVisiblePlatforms: vi.fn(),
      targetMessageId: null,
      setTargetMessageId: vi.fn(), setReplyingTo: vi.fn(), setIsGalleryOpen: vi.fn(), setActivePDF: vi.fn(), setLightboxImage: vi.fn(), setDraftAttachments: vi.fn(),
      setSummary: vi.fn(),
      globalSearchQuery: '', draftAttachments: [],
    });

    const { container } = render(
      <ChatArea 
        whatsapp={{ status: 'disconnected', user: null, qrCode: null, linkUri: null }}
        signal={{ status: 'disconnected', user: null, qrCode: null, linkUri: null }}
        telegram={{ status: 'disconnected', user: null, qrCode: null, linkUri: null }}
        email={{ status: 'disconnected', user: null, qrCode: null, linkUri: null }}
        slack={{ status: 'disconnected', user: null, qrCode: null, linkUri: null }}
      />
    );

    const bouncyDots = container.querySelectorAll('.animate-bounce');
    expect(bouncyDots.length).toBe(0);
  });
});
