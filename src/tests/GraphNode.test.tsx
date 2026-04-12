import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import GraphNode from '../../components/GraphNode';
import { Platform } from '../../types';

describe('GraphNode Attachment Rendering', () => {
  const mockUser = {
    id: '1',
    name: 'Test User',
    avatarInitials: 'TU',
    activePlatforms: [Platform.WhatsApp, Platform.Telegram],
  };

  const mockBaseMessage = {
    id: 'msg-1',
    userId: '1',
    platform: Platform.WhatsApp,
    content: 'Test content',
    timestamp: new Date(),
    isMe: false,
    hash: 'abcdef',
  };

  it('renders image attachments correctly', () => {
    const onImageClick = vi.fn();
    const messageWithImage = {
      ...mockBaseMessage,
      attachments: [
        {
          id: 'att-1',
          type: 'image' as const,
          url: 'http://localhost:3000/api/media/image.jpg',
          name: 'image.jpg',
          size: '1.2 MB'
        }
      ]
    };

    render(
      <GraphNode
        message={messageWithImage}
        activePlatforms={[Platform.WhatsApp, Platform.Telegram]}
        visiblePlatforms={new Set([Platform.WhatsApp, Platform.Telegram])}
        user={mockUser}
        onReply={vi.fn()}
        onImageClick={onImageClick}
      />
    );

    const imgElement = screen.getByAltText('image.jpg');
    expect(imgElement).toBeInTheDocument();
    expect(imgElement).toHaveAttribute('src', 'http://localhost:3000/api/media/image.jpg');

    // Click image
    fireEvent.click(imgElement.parentElement!);
    expect(onImageClick).toHaveBeenCalledWith(messageWithImage.attachments[0]);
  });

  it('renders document attachments correctly', () => {
    const onDocView = vi.fn();
    const messageWithDoc = {
      ...mockBaseMessage,
      attachments: [
        {
          id: 'att-2',
          type: 'document' as const,
          url: 'http://localhost:3000/api/media/doc.pdf',
          name: 'invoice.pdf',
          size: '4.5 MB'
        }
      ]
    };

    render(
      <GraphNode
        message={messageWithDoc}
        activePlatforms={[Platform.WhatsApp, Platform.Telegram]}
        visiblePlatforms={new Set([Platform.WhatsApp, Platform.Telegram])}
        user={mockUser}
        onReply={vi.fn()}
        onImageClick={vi.fn()}
        onDocView={onDocView}
      />
    );

    // Expand documents
    const showButton = screen.getByText(/Show Documents \(1\)/i);
    fireEvent.click(showButton);

    const docName = screen.getByText('invoice.pdf');
    expect(docName).toBeInTheDocument();

    const viewButton = screen.getByTitle('View invoice.pdf');
    expect(viewButton).toBeInTheDocument();

    fireEvent.click(viewButton);
    expect(onDocView).toHaveBeenCalledWith(messageWithDoc.attachments[0]);
  });
});

describe('GraphNode Reaction Rendering', () => {
  const mockUser = {
    id: '1',
    name: 'Test User',
    avatarInitials: 'TU',
    activePlatforms: [Platform.WhatsApp],
  };

  const messageWithReactions = {
    id: 'msg-reaction-1',
    userId: '1',
    platform: Platform.WhatsApp,
    content: 'React to me',
    timestamp: new Date(),
    isMe: false,
    hash: 'reaction1',
    reactions: [
      { emoji: '🔥', users: ['user1', 'user2'] },
      { emoji: '😂', users: ['user3'] }
    ]
  };

  it('renders reaction badges', () => {
    render(
      <GraphNode
        message={messageWithReactions}
        activePlatforms={[Platform.WhatsApp]}
        visiblePlatforms={new Set([Platform.WhatsApp])}
        user={mockUser}
        onReply={vi.fn()}
        onImageClick={vi.fn()}
      />
    );
    expect(screen.getByText('🔥')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // users length
    expect(screen.getByText('😂')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows emoji picker button on hover context', () => {
    render(
      <GraphNode
        message={{ ...messageWithReactions, reactions: [] }}
        activePlatforms={[Platform.WhatsApp]}
        visiblePlatforms={new Set([Platform.WhatsApp])}
        user={mockUser}
        onReply={vi.fn()}
        onImageClick={vi.fn()}
      />
    );
    const emojiButton = screen.getByTitle('Add reaction');
    expect(emojiButton).toBeInTheDocument();
    // Initially EmojiPicker not there
    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
    
    // Click button to open picker
    fireEvent.click(emojiButton);
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });
});

describe('GraphNode Message Status Rendering', () => {
  const mockUser = {
    id: '1',
    name: 'Test User',
    avatarInitials: 'TU',
    activePlatforms: [Platform.WhatsApp],
  };

  const baseMyMessage = {
    id: 'msg-1',
    userId: '1',
    platform: Platform.WhatsApp,
    content: 'Hello World',
    timestamp: new Date(),
    isMe: true,
    hash: '123456',
  };

  it('renders a single checkmark for sent status', () => {
    render(
      <GraphNode
        message={{ ...baseMyMessage, status: 'sent' }}
        activePlatforms={[Platform.WhatsApp]}
        visiblePlatforms={new Set([Platform.WhatsApp])}
        user={mockUser}
        onReply={vi.fn()}
        onImageClick={vi.fn()}
      />
    );
    expect(screen.getByTitle('Sent')).toBeInTheDocument();
  });

  it('renders a double checkmark for delivered status', () => {
    render(
      <GraphNode
        message={{ ...baseMyMessage, status: 'delivered' }}
        activePlatforms={[Platform.WhatsApp]}
        visiblePlatforms={new Set([Platform.WhatsApp])}
        user={mockUser}
        onReply={vi.fn()}
        onImageClick={vi.fn()}
      />
    );
    expect(screen.getByTitle('Delivered')).toBeInTheDocument();
  });

  it('renders a blue double checkmark for read status', () => {
    render(
      <GraphNode
        message={{ ...baseMyMessage, status: 'read' }}
        activePlatforms={[Platform.WhatsApp]}
        visiblePlatforms={new Set([Platform.WhatsApp])}
        user={mockUser}
        onReply={vi.fn()}
        onImageClick={vi.fn()}
      />
    );
    const readCheck = screen.getByTitle('Read');
    expect(readCheck).toBeInTheDocument();
    expect(readCheck).toHaveClass('text-blue-500');
  });

  it('does not render status for incoming messages', () => {
    render(
      <GraphNode
        message={{ ...baseMyMessage, isMe: false, status: 'read' }}
        activePlatforms={[Platform.WhatsApp]}
        visiblePlatforms={new Set([Platform.WhatsApp])}
        user={mockUser}
        onReply={vi.fn()}
        onImageClick={vi.fn()}
      />
    );
    expect(screen.queryByTitle('Read')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Sent')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delivered')).not.toBeInTheDocument();
  });
});