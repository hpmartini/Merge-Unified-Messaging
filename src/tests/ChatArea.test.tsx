import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatArea } from '../components/ChatArea';
import { Platform } from '../../types';
import { useAppStore } from '../store/useAppStore';

vi.mock('../store/useAppStore', () => ({
  useAppStore: vi.fn()
}));

const mockMessages = [
  {
    id: 'msg-1',
    userId: '1',
    platform: Platform.WhatsApp,
    content: 'Check this image',
    timestamp: new Date(),
    isMe: false,
    hash: 'abcdef',
    attachments: [
      {
        id: 'att-1',
        type: 'image',
        url: 'http://localhost:3000/api/media/image.jpg',
        name: 'image.jpg',
        size: '1.2 MB'
      }
    ]
  },
  {
    id: 'msg-2',
    userId: '1',
    platform: Platform.WhatsApp,
    content: 'And this document',
    timestamp: new Date(),
    isMe: true,
    hash: 'abcdef2',
    attachments: [
      {
        id: 'att-2',
        type: 'document',
        url: 'http://localhost:3000/api/media/doc.pdf',
        name: 'invoice.pdf',
        size: '4.5 MB'
      }
    ]
  }
];

describe('ChatArea Component Rendering Attachments', () => {
  let mockSetLightboxImage: any;
  let mockSetActivePDF: any;

  beforeEach(() => {
    mockSetLightboxImage = vi.fn();
    mockSetActivePDF = vi.fn();
    
    (useAppStore as any).mockReturnValue({
      selectedUser: {
        id: '1',
        name: 'Test User',
        avatarInitials: 'TU',
        activePlatforms: [Platform.WhatsApp],
        alternateIds: []
      },
      typingUsers: {},
      messages: mockMessages,
      visiblePlatforms: new Set([Platform.WhatsApp]),
      targetMessageId: null,
      globalSearchQuery: '',
      draftAttachments: [],
      replyingTo: null,
      setVisiblePlatforms: vi.fn(),
      setReplyingTo: vi.fn(),
      setIsGalleryOpen: vi.fn(),
      setLightboxImage: mockSetLightboxImage,
      setActivePDF: mockSetActivePDF,
      setDraftAttachments: vi.fn(),
      setLocalSearchQuery: vi.fn(),
      setTargetMessageId: vi.fn(),
      setSummary: vi.fn()
    });
  });

  it('renders chat area with image and document attachments and handles clicks', () => {
    render(<ChatArea whatsapp={{}} signal={{}} />);

    // Image Attachment check
    const imgElement = screen.getByAltText('image.jpg');
    expect(imgElement).toBeInTheDocument();
    
    fireEvent.click(imgElement);
    // Since GraphNode calls onImageClick on the wrapping div:
    fireEvent.click(imgElement.parentElement!);
    expect(mockSetLightboxImage).toHaveBeenCalledWith(mockMessages[0].attachments[0]);

    // Document Attachment check
    const showDocsButton = screen.getByText(/Show Documents \(1\)/i);
    fireEvent.click(showDocsButton);
    
    const docName = screen.getByText('invoice.pdf');
    expect(docName).toBeInTheDocument();
    
    const viewButton = screen.getByTitle('View invoice.pdf');
    fireEvent.click(viewButton);
    expect(mockSetActivePDF).toHaveBeenCalledWith(mockMessages[1].attachments[0]);
  });
});
describe('ChatArea Drag and Drop', () => {
  beforeEach(() => {
    (useAppStore as any).mockReturnValue({
      selectedUser: {
        id: '1',
        name: 'Test User',
        avatarInitials: 'TU',
        activePlatforms: [Platform.WhatsApp],
        alternateIds: []
      },
      typingUsers: {},
      messages: [],
      visiblePlatforms: new Set([Platform.WhatsApp]),
      targetMessageId: null,
      globalSearchQuery: '',
      draftAttachments: [],
      replyingTo: null,
      setVisiblePlatforms: vi.fn(),
      setReplyingTo: vi.fn(),
      setIsGalleryOpen: vi.fn(),
      setLightboxImage: vi.fn(),
      setActivePDF: vi.fn(),
      setDraftAttachments: vi.fn(),
      setLocalSearchQuery: vi.fn(),
      setTargetMessageId: vi.fn(),
      setSummary: vi.fn()
    });
  });

  it('shows overlay when dragging files over ChatArea', () => {
    const { container } = render(<ChatArea whatsapp={{}} signal={{}} />);
    
    // The main container is the first child
    const chatContainer = container.firstChild as HTMLElement;
    
    // Mock dataTransfer with items to simulate dragging files
    const mockDataTransfer = {
      items: [{ kind: 'file' }]
    };

    fireEvent.dragEnter(chatContainer, { dataTransfer: mockDataTransfer });
    
    // Look for the "Attach to Conversation" overlay text
    expect(screen.getByText('Attach to Conversation')).toBeInTheDocument();

    fireEvent.dragLeave(chatContainer);
  });
});
