import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Profile } from './Profile';
import GraphNode from '../../components/GraphNode';
import Composer from '../../components/Composer';
import { Message, Platform, Attachment } from '../../types';
import { UploadCloud, MessageCircle, MessagesSquare } from 'lucide-react';

export interface ChatAreaProps {
  whatsapp: any;
  signal: any;
  telegram?: any;
  email?: any;
  slack?: any;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ whatsapp, signal, telegram, email, slack }) => {
  // Store state
  const { selectedUser } = useAppStore();
  const { messages, setMessages, setUsers } = useAppStore();
  const { visiblePlatforms, setVisiblePlatforms } = useAppStore();
  const { targetMessageId, setTargetMessageId, setSummary } = useAppStore();
  const { globalSearchQuery } = useAppStore();
  const { draftAttachments, setDraftAttachments } = useAppStore();
  const { replyingTo, setReplyingTo } = useAppStore();
  const { setLightboxImage, setIsGalleryOpen, setActivePDF } = useAppStore();

  // Local state
  const [isLocalSearchOpen, setIsLocalSearchOpen] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dragCounter = useRef(0);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Global drag-and-drop prevent default to avoid browser navigation
  useEffect(() => {
    const handleWindowDragOver = (e: DragEvent) => e.preventDefault();
    const handleWindowDrop = (e: DragEvent) => e.preventDefault();
    
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);
    
    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, []);

  // Derived state
  const userMessages = useMemo(() => {
    if (!selectedUser) return [];
    const allIds = new Set([selectedUser.id, ...(selectedUser.alternateIds || [])]);
    return messages.filter(m => allIds.has(m.userId)).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [messages, selectedUser]);

  const localMatches = useMemo(() => {
    if (!localSearchQuery.trim() || !isLocalSearchOpen) return [];
    const query = localSearchQuery.toLowerCase();
    return userMessages.filter(m => 
      m.content.toLowerCase().includes(query) || 
      (m.subject && m.subject.toLowerCase().includes(query))
    );
  }, [userMessages, localSearchQuery, isLocalSearchOpen]);

  // Effects
  useEffect(() => {
    if (scrollContainerRef.current && !targetMessageId) {
      const timeoutId = setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({
            top: scrollContainerRef.current.scrollHeight,
            behavior: 'instant'
          });
        }
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [userMessages, selectedUser?.id, targetMessageId]);

  useEffect(() => {
    if (!selectedUser) return;
    setVisiblePlatforms(new Set(selectedUser.activePlatforms));
    setReplyingTo(null);
    setIsGalleryOpen(false);
    setLightboxImage(null);
    setActivePDF(null);
    setDraftAttachments([]);
    setLocalSearchQuery('');
    setIsLocalSearchOpen(false);
    setSummary(null);
    if (targetMessageId && !userMessages.find(m => m.id === targetMessageId)) {
        setTargetMessageId(null);
    }
  }, [selectedUser]);

  useEffect(() => {
    if (localMatches.length > 0) {
      setTargetMessageId(localMatches[currentMatchIndex]?.id);
    } else {
      setTargetMessageId(null);
    }
  }, [currentMatchIndex, localMatches]);

  // Handlers
  const navigateLocalMatch = (direction: 'next' | 'prev') => {
    if (localMatches.length === 0) return;
    if (direction === 'next') {
      setCurrentMatchIndex((prev) => (prev + 1) % localMatches.length);
    } else {
      setCurrentMatchIndex((prev) => (prev - 1 + localMatches.length) % localMatches.length);
    }
  };

  const processFiles = useCallback((files: FileList | File[]) => {
    setIsUploading(true);
    const fileArray = Array.from(files);
    
    let processedCount = 0;
    fileArray.forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        const attachmentId = Math.random().toString(36).substring(7);
        const newAttachment: Attachment = {
          id: attachmentId,
          type: file.type.startsWith('image/') ? 'image' : 'document',
          name: file.name,
          url: result,
          size: (file.size / 1024).toFixed(1) + ' KB',
          isUploading: true,
          uploadProgress: 0
        };
        setDraftAttachments(prev => [...prev, newAttachment]);
        
        // Actual API upload using XMLHttpRequest
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file', file);

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded * 100) / e.total);
            setDraftAttachments(prev => prev.map(att => 
              att.id === attachmentId ? { ...att, uploadProgress: progress } : att
            ));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            let responseUrl = result;
            try {
              const res = JSON.parse(xhr.responseText);
              if (res.url) responseUrl = res.url;
            } catch (err) {
              console.error('Failed to parse upload response', err);
            }
            setDraftAttachments(prev => prev.map(att => 
              att.id === attachmentId ? { ...att, isUploading: false, uploadProgress: 100, url: responseUrl } : att
            ));
          } else {
            console.error('Upload failed with status:', xhr.status);
            setDraftAttachments(prev => prev.filter(att => att.id !== attachmentId));
          }
          processedCount++;
          if (processedCount === fileArray.length && isMounted.current) setIsUploading(false);
        });

        xhr.addEventListener('error', () => {
          console.error('Upload network error');
          setDraftAttachments(prev => prev.filter(att => att.id !== attachmentId));
          processedCount++;
          if (processedCount === fileArray.length && isMounted.current) setIsUploading(false);
        });

        xhr.open('POST', '/api/upload', true);
        xhr.withCredentials = true; // Use cookies for authentication
        
        // Note: For authorization via token header, if needed:
        // const token = localStorage.getItem('jwt');
        // if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        xhr.send(formData);
      };
      reader.onerror = () => {
        processedCount++;
        if (processedCount === fileArray.length && isMounted.current) setIsUploading(false);
      };
      reader.readAsDataURL(file);
    });
  }, [setDraftAttachments]);

  const handleSendMessage = (content: string, platform: Platform, attachments?: Attachment[]) => {
    if (!selectedUser) return;
    const now = Date.now();
    let targetChatId = '';
    
    if (platform === Platform.Signal) {
      const sigId = selectedUser.id.startsWith('sig-') ? selectedUser.id : selectedUser.alternateIds?.find(id => id.startsWith('sig-'));
      if (sigId) targetChatId = sigId.replace('sig-', '');
    } else if (platform === Platform.WhatsApp) {
      const waId = selectedUser.id.startsWith('wa-') ? selectedUser.id : selectedUser.alternateIds?.find(id => id.startsWith('wa-'));
      if (waId) targetChatId = waId.replace('wa-', '');
    } else if (platform === Platform.Telegram) {
      const tgId = selectedUser.id.startsWith('tg-') ? selectedUser.id : selectedUser.alternateIds?.find(id => id.startsWith('tg-'));
      if (tgId) targetChatId = tgId.replace('tg-', '');
    } else if (platform === Platform.Slack) {
      const slackId = selectedUser.id.startsWith('slack-') ? selectedUser.id : selectedUser.alternateIds?.find(id => id.startsWith('slack-'));
      if (slackId) targetChatId = slackId.replace('slack-', '');
    } else if (platform === Platform.Email) {
      const emailId = selectedUser.id.startsWith('email-') ? selectedUser.id : selectedUser.alternateIds?.find(id => id.startsWith('email-'));
      if (emailId) targetChatId = emailId.replace('email-', '');
    }

    const rawMsgId = targetChatId ? `${now}_${targetChatId}_sent` : now.toString();
    const msgId = targetChatId
      ? (platform === Platform.Signal ? `sig-${rawMsgId}` : 
         platform === Platform.WhatsApp ? `wa-${rawMsgId}` :
         platform === Platform.Slack ? `slack-${rawMsgId}` :
         platform === Platform.Email ? `email-${rawMsgId}` :
         `tg-${rawMsgId}`)
      : rawMsgId;

    const newMessage: Message = {
      id: msgId,
      userId: selectedUser.id,
      platform,
      content,
      timestamp: new Date(now),
      isMe: true,
      hash: Math.random().toString(16).substring(2, 9),
      replyToId: replyingTo?.id,
      replyToPlatform: replyingTo?.platform,
      replyToContent: replyingTo?.content,
      attachments: attachments || [],
    };

    if (platform === Platform.WhatsApp && whatsapp.status === 'ready' && targetChatId) {
      whatsapp.sendMessage(targetChatId + '@c.us', content, rawMsgId);
    }
    if (platform === Platform.Signal && (signal.status === 'ready' || signal.chats.length > 0) && targetChatId) {
      signal.sendMessage(targetChatId, content, rawMsgId);
    }
    if (platform === Platform.Telegram && telegram?.status === 'ready' && targetChatId) {
      telegram.sendMessage(targetChatId, content);
    }
    if (platform === Platform.Email && email?.status === 'ready' && targetChatId) {
      email.sendMessage(targetChatId, content);
    }
    if (platform === Platform.Slack && slack?.status === 'ready' && targetChatId) {
      slack.sendMessage(targetChatId, content, replyingTo?.id?.replace('slack-', ''));
    }

    setMessages([...messages, newMessage]);
    setReplyingTo(null);
    setDraftAttachments([]);
    setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, lastMessageTime: newMessage.timestamp } : u));
  };

  const handleDocumentAction = (att: Attachment) => {
    if (att.name.toLowerCase().endsWith('.pdf')) {
      setActivePDF(att);
    } else {
      const link = document.createElement('a');
      link.href = att.url;
      link.download = att.name;
      link.click();
    }
  };

  if (!selectedUser) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-theme-muted">
        <MessageCircle className="w-16 h-16 mb-4 stroke-1 opacity-50" />
        <h2 className="text-xl font-bold text-theme-main mb-2">Welcome to Merge</h2>
        <p className="text-sm mb-4">Select a conversation to get started</p>
      </div>
    );
  }

  return (
    <div 
      className="flex-1 flex flex-col min-w-0 relative bg-theme-base"
      onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); dragCounter.current++; if (e.dataTransfer.items.length > 0) setIsDragging(true); }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); dragCounter.current--; if (dragCounter.current === 0) setIsDragging(false); }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); dragCounter.current = 0; if (e.dataTransfer.files.length > 0) { processFiles(e.dataTransfer.files); e.dataTransfer.clearData(); } }}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none animate-in fade-in zoom-in duration-300">
          <div className="absolute inset-0 bg-blue-600/10 backdrop-blur-md border-[6px] border-dashed border-blue-500/40 m-4 rounded-2xl" />
          <div className="bg-theme-panel/90 border border-blue-500/50 p-12 rounded-3xl shadow-[0_0_50px_rgba(37,99,235,0.3)] flex flex-col items-center gap-6 animate-pulse">
            <div className="bg-blue-600 p-6 rounded-full shadow-lg shadow-blue-500/20">
              <UploadCloud className="w-12 h-12 text-white" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-theme-main mb-2">Attach to Conversation</h2>
              <p className="text-theme-muted">Drop your images or documents anywhere to upload</p>
            </div>
          </div>
        </div>
      )}

      <Profile 
        userMessages={userMessages}
        isLocalSearchOpen={isLocalSearchOpen}
        setIsLocalSearchOpen={setIsLocalSearchOpen}
        localSearchQuery={localSearchQuery}
        setLocalSearchQuery={setLocalSearchQuery}
        currentMatchIndex={currentMatchIndex}
        setCurrentMatchIndex={setCurrentMatchIndex}
        localMatches={localMatches}
        navigateLocalMatch={navigateLocalMatch}
      />

      <div className="flex-1 overflow-hidden relative flex flex-col">
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto pt-6 pb-4 scroll-smooth">
          {userMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-theme-muted opacity-50">
              <MessagesSquare className="w-16 h-16 mb-4 stroke-1" />
              <p className="font-sans text-sm">No messages yet</p>
              <p className="text-xs">Start the conversation below</p>
            </div>
          ) : (
            userMessages.map(msg => (
              <GraphNode
                key={msg.id}
                message={msg}
                activePlatforms={selectedUser.activePlatforms}
                visiblePlatforms={visiblePlatforms}
                onReply={setReplyingTo}
                user={selectedUser}
                onImageClick={setLightboxImage}
                onDocView={handleDocumentAction}
                isTargeted={targetMessageId === msg.id}
                searchTerm={isLocalSearchOpen ? localSearchQuery : globalSearchQuery}
                singleChannel={selectedUser.activePlatforms.length === 1}
              />
            ))
          )}
        </div>

        <Composer
          selectedUser={selectedUser}
          onSendMessage={handleSendMessage}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          draftAttachments={draftAttachments}
          onRemoveAttachment={(id) => setDraftAttachments(prev => prev.filter(a => a.id !== id))}
          onAddFiles={processFiles}
          isUploading={isUploading}
        />
      </div>
    </div>
  );
};
