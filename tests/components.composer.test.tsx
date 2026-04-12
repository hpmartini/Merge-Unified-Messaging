import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

  it('renders a global spinner if isUploading is true but no attachments have isUploading yet', () => {
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
    
    expect(container.querySelector('.animate-pulse')).toBeDefined();
  });
});

describe('Composer Voice Notes', () => {
  beforeEach(() => {
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }]
        }),
      },
      configurable: true
    });

    const mockMediaRecorder = {
      start: vi.fn(),
      stop: vi.fn(function() {
        this.state = 'inactive';
        if (this.onstop) this.onstop();
      }),
      state: 'inactive',
      ondataavailable: null,
      onstop: null,
    };
    
    global.MediaRecorder = vi.fn().mockImplementation(() => mockMediaRecorder) as any;
  });

  it('toggles recording UI when mic button is clicked', async () => {
    const onAddFiles = vi.fn();
    const { container } = render(
      <Composer 
        selectedUser={{ id: 'u1', name: 'User 1', avatarInitials: 'U1', activePlatforms: ['Telegram' as any] }}
        onSendMessage={vi.fn()}
        replyingTo={null}
        onCancelReply={vi.fn()}
        draftAttachments={[]}
        onRemoveAttachment={vi.fn()}
        onAddFiles={onAddFiles}
        isUploading={false}
      />
    );

    // Mic button should be present
    const micButton = container.querySelector('button .lucide-mic')?.parentElement;
    expect(micButton).toBeDefined();

    // Click mic button
    await act(async () => {
      fireEvent.click(micButton!);
    });

    // Recording UI should appear (00:00 duration)
    await waitFor(() => {
      expect(screen.getByText('00:00')).toBeDefined();
    });

    // Square (stop) button should appear
    const stopButton = container.querySelector('button .lucide-square')?.parentElement;
    expect(stopButton).toBeDefined();

    // Stop recording
    await act(async () => {
      fireEvent.click(stopButton!);
    });

    // Should call onAddFiles with a File object
    expect(onAddFiles).toHaveBeenCalled();
    const args = onAddFiles.mock.calls[0][0];
    expect(args[0]).toBeInstanceOf(File);
    expect(args[0].type).toBe('audio/webm');
  });

  it('cancels recording and does not add files when trash button is clicked', async () => {
    const onAddFiles = vi.fn();
    const { container } = render(
      <Composer 
        selectedUser={{ id: 'u1', name: 'User 1', avatarInitials: 'U1', activePlatforms: ['Telegram' as any] }}
        onSendMessage={vi.fn()}
        replyingTo={null}
        onCancelReply={vi.fn()}
        draftAttachments={[]}
        onRemoveAttachment={vi.fn()}
        onAddFiles={onAddFiles}
        isUploading={false}
      />
    );

    const micButton = container.querySelector('button .lucide-mic')?.parentElement;
    
    await act(async () => {
      fireEvent.click(micButton!);
    });

    await waitFor(() => {
      expect(screen.getByText('00:00')).toBeDefined();
    });

    // Find and click trash button
    const trashButton = container.querySelector('button .lucide-trash')?.parentElement;
    
    await act(async () => {
      fireEvent.click(trashButton!);
    });

    expect(onAddFiles).not.toHaveBeenCalled();
    expect(screen.queryByText('00:00')).toBeNull();
  });
});

