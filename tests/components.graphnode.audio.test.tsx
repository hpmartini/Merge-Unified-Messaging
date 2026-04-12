import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GraphNode from '../components/GraphNode';
import { Platform, Message, User } from '../types';

describe('GraphNode Voice Notes', () => {
  it('renders AudioWaveform for audio attachments', () => {
    const mockUser: User = {
      id: 'u1',
      name: 'Test User',
      avatarInitials: 'TU',
      activePlatforms: [Platform.Telegram]
    };

    const mockMessage: Message = {
      id: 'm1',
      userId: 'u1',
      platform: Platform.Telegram,
      content: '',
      timestamp: new Date(),
      isMe: true,
      hash: 'abc',
      attachments: [{
        id: 'a1',
        name: 'voicenote.webm',
        type: 'document',
        url: 'blob:http://localhost/123',
        size: '100 KB',
        mediaType: 'audio'
      }]
    };

    const { container } = render(
      <GraphNode
        message={mockMessage}
        activePlatforms={[Platform.Telegram]}
        visiblePlatforms={new Set([Platform.Telegram])}
        onReply={vi.fn()}
        user={mockUser}
        onImageClick={vi.fn()}
      />
    );

    // Should render the audio element from AudioWaveform
    const audioEl = container.querySelector('audio');
    expect(audioEl).toBeDefined();
    expect(audioEl?.getAttribute('src')).toBe('blob:http://localhost/123');
  });
});
