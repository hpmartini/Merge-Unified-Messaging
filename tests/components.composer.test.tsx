import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Composer from '../components/Composer';
import { Attachment } from '../types';

describe('Composer Upload Progress', () => {
  it('renders progress bar for uploading attachments', () => {
    const mockAttachment: Attachment = {
      id: '1',
      name: 'test.jpg',
      type: 'image',
      url: 'data:image/jpeg;base64,123',
      size: '10 KB',
      isUploading: true,
      uploadProgress: 45
    };

    render(
      <Composer 
        selectedUser={{ id: 'u1', name: 'User 1', avatarInitials: 'U1', activePlatforms: ['Telegram' as any] }}
        onSendMessage={vi.fn()}
        replyingTo={null}
        onCancelReply={vi.fn()}
        draftAttachments={[mockAttachment]}
        onRemoveAttachment={vi.fn()}
        onAddFiles={vi.fn()}
        isUploading={true}
      />
    );

    // Look for the progress text
    const progressText = screen.getByText('45%');
    expect(progressText).toBeDefined();
    
    // Look for the element with width: 45%
    const progressBar = screen.getByText('45%').previousSibling?.firstChild as HTMLElement;
    expect(progressBar.style.width).toBe('45%');
  });

  it('renders a global spinner if isUploading is true but no attachments have isUploading yet (e.g. during initial read)', () => {
    const { container } = render(
      <Composer 
        selectedUser={{ id: 'u1', name: 'User 1', avatarInitials: 'U1', activePlatforms: ['Telegram' as any] }}
        onSendMessage={vi.fn()}
        replyingTo={null}
        onCancelReply={vi.fn()}
        draftAttachments={[]}
        onRemoveAttachment={vi.fn()}
        onAddFiles={vi.fn()}
        isUploading={true}
      />
    );
    
    // Should have animate-pulse wrapper for the global spinner
    expect(container.querySelector('.animate-pulse')).toBeDefined();
  });
});
