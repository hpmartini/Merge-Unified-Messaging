import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import Composer from '../../components/Composer';
import { Platform } from '../../types';

describe('Composer Component', () => {
  const mockSelectedUser = {
    id: 'user-1',
    name: 'Test User',
    avatarInitials: 'TU',
    activePlatforms: [Platform.WhatsApp],
    alternateIds: []
  };

  it('renders file picker icon and handles file selection', async () => {
    const mockOnAddFiles = vi.fn();
    render(
      <Composer
        selectedUser={mockSelectedUser}
        onSendMessage={vi.fn()}
        replyingTo={null}
        onCancelReply={vi.fn()}
        draftAttachments={[]}
        onRemoveAttachment={vi.fn()}
        onAddFiles={mockOnAddFiles}
        isUploading={false}
      />
    );

    // Find the hidden file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    const file = new File(['hello'], 'hello.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(mockOnAddFiles).toHaveBeenCalled();
  });
});
