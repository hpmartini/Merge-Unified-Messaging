
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Composer from './components/Composer';
import GraphNode from './components/GraphNode';
import MediaGallery from './components/MediaGallery';
import Lightbox from './components/Lightbox';
import PDFViewer from './components/PDFViewer';
import SettingsModal from './components/SettingsModal';
import { USERS, INITIAL_MESSAGES, PLATFORM_CONFIG } from './constants';
import { User, Message, Platform, Attachment } from './types';
import { useWhatsApp, WhatsAppChat, WhatsAppMessage } from './hooks/useWhatsApp';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GoogleGenAI } from "@google/genai";
import { Share2, Filter, MessagesSquare, FolderOpen, UploadCloud, Search, ChevronUp, ChevronDown, X, Bot, Sparkles, Loader2, ArrowLeft, Clock, Users, MessageCircle } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [users, setUsers] = useState<User[]>(USERS);
  const [selectedUser, setSelectedUser] = useState<User>(USERS[0]);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [visiblePlatforms, setVisiblePlatforms] = useState<Set<Platform>>(new Set(Object.values(Platform)));
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<Attachment | null>(null);
  const [activePDF, setActivePDF] = useState<Attachment | null>(null);

  // Mobile View State
  const [showMobileChat, setShowMobileChat] = useState(false);

  // Settings & Theme
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'dimmed' | 'light'>('dark');

  // WhatsApp Integration
  const handleWhatsAppMessage = useCallback((waMsg: WhatsAppMessage) => {
    // Convert WhatsApp message to app Message format
    const newMessage: Message = {
      id: `wa-${waMsg.id}`,
      userId: `wa-${waMsg.contactId}`,
      platform: Platform.WhatsApp,
      content: waMsg.body,
      timestamp: new Date(waMsg.timestamp * 1000),
      isMe: waMsg.fromMe,
      hash: waMsg.id.substring(0, 7),
    };

    setMessages(prev => {
      // Check if message already exists
      if (prev.find(m => m.id === newMessage.id)) return prev;
      return [...prev, newMessage];
    });
  }, []);

  // We need a ref to access serverPort in the callback
  const serverPortRef = useRef<number | null>(null);

  const handleWhatsAppChatsLoaded = useCallback((chats: WhatsAppChat[]) => {
    // Convert WhatsApp chats to Users
    const waUsers: User[] = chats
      .filter(chat => !chat.isGroup) // Only individual chats for now
      .map(chat => {
        // Construct avatar URL if available
        let avatarUrl: string | undefined;
        if (chat.avatarUrl && serverPortRef.current) {
          avatarUrl = `http://localhost:${serverPortRef.current}${chat.avatarUrl}`;
        }

        return {
          id: `wa-${chat.id.replace('@c.us', '')}`,
          name: chat.name,
          avatarInitials: chat.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
          avatarUrl,
          activePlatforms: [Platform.WhatsApp],
          role: 'WhatsApp Contact'
        };
      });

    setUsers(prev => {
      // Merge with existing users, update avatar URLs for existing ones
      const existingIds = new Set(prev.map(u => u.id));
      const newUsers = waUsers.filter(u => !existingIds.has(u.id));

      // Update avatars for existing WhatsApp users
      const updatedPrev = prev.map(u => {
        const waUser = waUsers.find(wa => wa.id === u.id);
        if (waUser && waUser.avatarUrl && !u.avatarUrl) {
          return { ...u, avatarUrl: waUser.avatarUrl };
        }
        return u;
      });

      return [...updatedPrev, ...newUsers];
    });
  }, []);

  const handleWhatsAppMessagesLoaded = useCallback((chatId: string, waMessages: WhatsAppMessage[]) => {
    const userId = `wa-${chatId.replace('@c.us', '')}`;

    const newMessages: Message[] = waMessages.map(waMsg => ({
      id: `wa-${waMsg.id}`,
      userId: userId,
      platform: Platform.WhatsApp,
      content: waMsg.body,
      timestamp: new Date(waMsg.timestamp * 1000),
      isMe: waMsg.fromMe,
      hash: waMsg.id.substring(0, 7),
    }));

    setMessages(prev => {
      // Filter out duplicates
      const existingIds = new Set(prev.map(m => m.id));
      const uniqueNew = newMessages.filter(m => !existingIds.has(m.id));
      return [...prev, ...uniqueNew];
    });
  }, []);

  const whatsapp = useWhatsApp('merge-app', {
    onMessage: handleWhatsAppMessage,
    onChatsLoaded: handleWhatsAppChatsLoaded,
    onMessagesLoaded: handleWhatsAppMessagesLoaded,
  });

  // Keep server port ref updated for avatar URLs
  useEffect(() => {
    serverPortRef.current = whatsapp.serverPort;
  }, [whatsapp.serverPort]);

  // Auto-connect to WhatsApp on app startup (if session exists, it will reconnect)
  useEffect(() => {
    // Small delay to let the app render first
    const timer = setTimeout(() => {
      console.log('[App] Auto-connecting to WhatsApp...');
      whatsapp.connect();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount - intentionally not including whatsapp.connect to prevent re-runs

  // Load messages when selecting a WhatsApp user
  useEffect(() => {
    if (selectedUser.id.startsWith('wa-') && whatsapp.status === 'ready') {
      const chatId = selectedUser.id.replace('wa-', '') + '@c.us';
      whatsapp.getMessages(chatId, 100);
    }
  }, [selectedUser.id, whatsapp.status]);

  // Global Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [targetMessageId, setTargetMessageId] = useState<string | null>(null);
  
  // Local Conversation Search State
  const [isLocalSearchOpen, setIsLocalSearchOpen] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Draft State
  const [draftAttachments, setDraftAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // AI Summary State
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryOptions, setSummaryOptions] = useState({
    blockLimit: 1, // Number of "conversation blocks" to summarize
    groupingMinutes: 5, // Minutes between messages to count as one block
    includeOthers: true,
    includeMe: true
  });

  // --- Refs ---
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dragCounter = useRef(0);
  const localSearchInputRef = useRef<HTMLInputElement>(null);

  // --- Derived State ---
  const userMessages = useMemo(() => {
    return messages
      .filter(m => m.userId === selectedUser.id)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [messages, selectedUser.id]);

  const globalSearchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return messages.filter(m => 
      m.content.toLowerCase().includes(query) || 
      (m.subject && m.subject.toLowerCase().includes(query))
    ).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [messages, searchQuery]);

  // Local Match Navigation
  const localMatches = useMemo(() => {
    if (!localSearchQuery.trim() || !isLocalSearchOpen) return [];
    const query = localSearchQuery.toLowerCase();
    return userMessages.filter(m => 
      m.content.toLowerCase().includes(query) || 
      (m.subject && m.subject.toLowerCase().includes(query))
    );
  }, [userMessages, localSearchQuery, isLocalSearchOpen]);

  // --- Effects ---
  
  // Apply Theme to Document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (scrollContainerRef.current && !targetMessageId) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [userMessages.length, selectedUser.id, targetMessageId]);

  useEffect(() => {
    setVisiblePlatforms(new Set(selectedUser.activePlatforms));
    setReplyingTo(null);
    setIsGalleryOpen(false);
    setLightboxImage(null);
    setActivePDF(null);
    setDraftAttachments([]);
    setLocalSearchQuery('');
    setIsLocalSearchOpen(false);
    setSummary(null); // Clear summary on user switch
    if (targetMessageId && !userMessages.find(m => m.id === targetMessageId)) {
        setTargetMessageId(null);
    }
  }, [selectedUser]);

  useEffect(() => {
    if (isLocalSearchOpen && localSearchInputRef.current) {
      localSearchInputRef.current.focus();
    }
  }, [isLocalSearchOpen]);

  // Handle jump for local matches
  useEffect(() => {
    if (localMatches.length > 0) {
      setTargetMessageId(localMatches[currentMatchIndex]?.id);
    } else {
      setTargetMessageId(null);
    }
  }, [currentMatchIndex, localMatches]);

  // --- Handlers ---
  
  const handleUserSelection = (u: User) => {
    setSelectedUser(u);
    setShowMobileChat(true);
  };

  const handleSearchResultClick = (message: Message) => {
    const user = users.find(u => u.id === message.userId);
    if (user) {
      setTargetMessageId(message.id);
      setSelectedUser(user);
      const nextVisible = new Set(visiblePlatforms);
      nextVisible.add(message.platform);
      setVisiblePlatforms(nextVisible);
      setShowMobileChat(true);
    }
  };

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
        const newAttachment: Attachment = {
          id: Math.random().toString(36).substring(7),
          type: file.type.startsWith('image/') ? 'image' : 'document',
          name: file.name,
          url: result,
          size: (file.size / 1024).toFixed(1) + ' KB'
        };
        setDraftAttachments(prev => [...prev, newAttachment]);
        processedCount++;
        if (processedCount === fileArray.length) {
          setIsUploading(false);
        }
      };
      reader.onerror = () => {
        processedCount++;
        if (processedCount === fileArray.length) setIsUploading(false);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleSendMessage = (content: string, platform: Platform, attachments?: Attachment[]) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      userId: selectedUser.id,
      platform,
      content,
      timestamp: new Date(),
      isMe: true,
      hash: Math.random().toString(16).substring(2, 9),
      replyToId: replyingTo?.id,
      replyToPlatform: replyingTo?.platform,
      replyToContent: replyingTo?.content,
      attachments: attachments || [],
    };

    // Send via WhatsApp if it's a WhatsApp contact and platform is WhatsApp
    if (selectedUser.id.startsWith('wa-') && platform === Platform.WhatsApp && whatsapp.status === 'ready') {
      const chatId = selectedUser.id.replace('wa-', '') + '@c.us';
      whatsapp.sendMessage(chatId, content);
    }

    setMessages([...messages, newMessage]);
    setReplyingTo(null);
    setDraftAttachments([]);
  };

  const togglePlatform = (p: Platform) => {
    const next = new Set(visiblePlatforms);
    if (next.has(p)) {
      next.delete(p);
    } else {
      next.add(p);
    }
    setVisiblePlatforms(next);
  };

  const handleDocumentAction = (att: Attachment) => {
    if (att.name.toLowerCase().endsWith('.pdf')) {
      setActivePDF(att);
    } else {
      // Direct download fallback for non-PDF docs if clicked on View
      const link = document.createElement('a');
      link.href = att.url;
      link.download = att.name;
      link.click();
    }
  };

  const handleSummarize = async () => {
    if (!process.env.API_KEY) {
        console.error("API Key not found");
        return;
    }
    if (isSummarizing) return;

    if (!summaryOptions.includeOthers && !summaryOptions.includeMe) {
        setSummary("Please select at least one participant (Me or Contact) to summarize.");
        return;
    }

    setIsSummarizing(true);
    setSummary(null);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // 1. Filter Participants
        let relevantMessages = userMessages.filter(m => {
            if (m.isMe) return summaryOptions.includeMe;
            return summaryOptions.includeOthers;
        });

        // 2. Group messages by time proximity (Conversation Blocks)
        // Ensure sorted chronologically
        relevantMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        
        const groups: Message[][] = [];
        if (relevantMessages.length > 0) {
            let currentGroup = [relevantMessages[0]];
            
            for (let i = 1; i < relevantMessages.length; i++) {
                const prev = relevantMessages[i-1];
                const curr = relevantMessages[i];
                // Difference in minutes
                const diffMinutes = (curr.timestamp.getTime() - prev.timestamp.getTime()) / 60000;
                
                if (diffMinutes <= summaryOptions.groupingMinutes) {
                    currentGroup.push(curr);
                } else {
                    groups.push(currentGroup);
                    currentGroup = [curr];
                }
            }
            groups.push(currentGroup);
        }

        // 3. Select the last N blocks as requested
        const blocksToProcess = groups.slice(-summaryOptions.blockLimit);
        const finalMessages = blocksToProcess.flat();

        if (finalMessages.length === 0) {
            setSummary("No messages found with current filters.");
            setIsSummarizing(false);
            return;
        }

        const historyText = finalMessages.map(m => 
            `[${m.timestamp.toISOString()}] ${m.isMe ? 'Me' : selectedUser.name} (${m.platform}): ${m.content}`
        ).join('\n');

        const prompt = `You are a helpful assistant for a unified messaging app. 
        Analyze the following conversation history between "Me" (the user) and "${selectedUser.name}".
        Provide a concise summary in markdown format with the following structure:
        - **TL;DR**: One sentence overview.
        - **Key Topics**: Bullet points of main subjects discussed.
        - **Action Items**: Any tasks or follow-ups mentioned (if any).
        
        Conversation History (${finalMessages.length} messages, ${blocksToProcess.length} interaction blocks):
        ${historyText}`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt
        });

        setSummary(response.text || "No summary available.");
    } catch (e) {
        console.error("Summarization failed", e);
        setSummary("Failed to generate summary. Please check your API configuration.");
    } finally {
        setIsSummarizing(false);
    }
  };

  return (
    <div className="flex h-screen bg-theme-base text-theme-main overflow-hidden font-sans selection:bg-blue-500/30">
      
      {/* Mobile: Toggle Sidebar visibility */}
      <div className={`${showMobileChat ? 'hidden' : 'flex'} w-full md:w-auto md:flex h-full`}>
        <Sidebar
            users={users}
            selectedUser={selectedUser}
            onSelectUser={handleUserSelection}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchResults={globalSearchResults}
            onSearchResultClick={handleSearchResultClick}
            onOpenSettings={() => setIsSettingsOpen(true)}
        />
      </div>

      {/* Mobile: Toggle Main Chat visibility */}
      <div 
        className={`${showMobileChat ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0 relative bg-theme-base`}
        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); dragCounter.current++; if (e.dataTransfer.items.length > 0) setIsDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); dragCounter.current--; if (dragCounter.current === 0) setIsDragging(false); }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); dragCounter.current = 0; if (e.dataTransfer.files.length > 0) { processFiles(e.dataTransfer.files); e.dataTransfer.clearData(); } }}
      >
        {/* Canvas Drop Overlay */}
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

        {/* Top Header */}
        <header className="min-h-14 border-b border-theme bg-theme-panel/50 backdrop-blur flex flex-col justify-center flex-shrink-0 z-10 transition-all">
            <div className="flex items-center px-6 h-14 justify-between w-full">
                <div className="flex items-center gap-3 flex-1">
                    {/* Mobile Back Button */}
                    <button 
                        onClick={() => setShowMobileChat(false)}
                        className="md:hidden p-1 -ml-2 mr-2 text-theme-muted hover:text-theme-main rounded-full hover:bg-theme-hover transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>

                    {!isLocalSearchOpen ? (
                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                        <Share2 className="w-5 h-5 text-theme-muted" />
                        <span className="font-sans text-theme-main font-bold text-lg">
                            {selectedUser.name}
                        </span>
                        <span className="text-xs bg-theme-hover px-2 py-1 rounded text-theme-muted border border-theme">
                            {userMessages.length} messages
                        </span>
                    </div>
                    ) : (
                    <div className="flex items-center gap-2 bg-theme-base/80 border border-theme rounded-lg px-3 py-1 flex-1 max-w-md animate-in fade-in zoom-in duration-300">
                        <Search className="w-4 h-4 text-blue-500" />
                        <input 
                            ref={localSearchInputRef}
                            type="text" 
                            value={localSearchQuery}
                            onChange={(e) => { setLocalSearchQuery(e.target.value); setCurrentMatchIndex(0); }}
                            placeholder={`Search in conversation with ${selectedUser.name}...`}
                            className="bg-transparent border-none text-sm text-theme-main focus:outline-none w-full py-1"
                        />
                        {localMatches.length > 0 && (
                            <div className="flex items-center gap-1 border-l border-theme pl-2 ml-2">
                            <span className="text-[10px] font-mono text-theme-muted whitespace-nowrap">
                                {currentMatchIndex + 1} / {localMatches.length}
                            </span>
                            <button onClick={() => navigateLocalMatch('prev')} className="p-1 hover:bg-theme-hover rounded text-theme-muted"><ChevronUp className="w-3.5 h-3.5" /></button>
                            <button onClick={() => navigateLocalMatch('next')} className="p-1 hover:bg-theme-hover rounded text-theme-muted"><ChevronDown className="w-3.5 h-3.5" /></button>
                            </div>
                        )}
                        <button 
                            onClick={() => { setIsLocalSearchOpen(false); setLocalSearchQuery(''); setTargetMessageId(null); }}
                            className="p-1 hover:bg-theme-hover rounded text-theme-muted"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    )}
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4 hidden sm:flex">
                    <div className="flex items-center gap-2 text-xs font-mono text-theme-muted mr-2">
                        <Filter className="w-3 h-3" />
                        <span className="hidden lg:inline">CHANNELS:</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {selectedUser.activePlatforms.map(p => {
                        const isActive = visiblePlatforms.has(p);
                        const config = PLATFORM_CONFIG[p];
                        return (
                            <button
                            key={p}
                            onClick={() => togglePlatform(p)}
                            className={`
                                px-2 py-0.5 rounded border text-[11px] font-semibold transition-all flex items-center gap-1.5
                                ${isActive 
                                ? `${config.bgColor} text-white border-transparent` 
                                : 'bg-theme-base text-theme-muted border-theme hover:border-slate-500'}
                            `}
                            >
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-slate-500'}`} />
                            <span className="hidden md:inline">{config.label}</span>
                            </button>
                        )
                        })}
                    </div>
                    </div>

                    <div className="w-px h-6 bg-theme-hover hidden sm:block" />

                    <div className="flex items-center gap-1">
                    {/* Advanced AI Summary with Settings Dropdown */}
                    <div className="relative group">
                        <button
                            onClick={handleSummarize}
                            disabled={isSummarizing}
                            className={`p-2 rounded transition-colors ${isSummarizing || summary ? 'bg-indigo-500/20 text-indigo-400' : 'text-theme-muted hover:text-indigo-400 hover:bg-theme-hover'}`}
                        >
                            {isSummarizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                        </button>

                        {/* Hover Dropdown for Settings */}
                        <div className="absolute right-0 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                            <div 
                                className="w-72 backdrop-blur-[100px] border border-theme/20 rounded-2xl shadow-2xl p-5 origin-top-right ring-1 ring-white/5"
                                style={{ backgroundColor: 'color-mix(in srgb, var(--bg-panel), transparent 15%)' }}
                            >
                                <h4 className="text-[10px] font-bold text-theme-muted uppercase tracking-wider mb-4 border-b border-theme/50 pb-2 flex items-center gap-2">
                                    <Sparkles className="w-3 h-3 text-indigo-400" />
                                    Summary Config
                                </h4>
                                
                                {/* 1. Number of Blocks Selection */}
                                <div className="mb-4 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-theme-main flex items-center gap-1.5">
                                            <MessagesSquare className="w-3 h-3 text-theme-muted" />
                                            Summarize Blocks
                                        </label>
                                        <span className="text-[10px] font-mono bg-theme-base border border-theme px-1.5 py-0.5 rounded text-theme-main">
                                            {summaryOptions.blockLimit}
                                        </span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="1" 
                                        max="10" 
                                        step="1"
                                        value={summaryOptions.blockLimit}
                                        onChange={(e) => setSummaryOptions({...summaryOptions, blockLimit: parseInt(e.target.value)})}
                                        className="w-full h-1.5 bg-theme-base rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                    />
                                    <p className="text-[9px] text-theme-muted leading-tight">
                                        Summarizes the last <strong>{summaryOptions.blockLimit}</strong> conversation block(s).
                                    </p>
                                </div>

                                {/* 2. Grouping Time Selection */}
                                <div className="mb-4 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-theme-main flex items-center gap-1.5">
                                            <Clock className="w-3 h-3 text-theme-muted" />
                                            Grouping Window
                                        </label>
                                        <span className="text-[10px] font-mono bg-theme-base border border-theme px-1.5 py-0.5 rounded text-theme-main">
                                            {summaryOptions.groupingMinutes}m
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            min="1" 
                                            max="60"
                                            value={summaryOptions.groupingMinutes}
                                            onChange={(e) => setSummaryOptions({...summaryOptions, groupingMinutes: Math.max(1, parseInt(e.target.value))})}
                                            className="w-12 text-center bg-theme-base border border-theme rounded text-xs py-1 focus:border-indigo-500 focus:outline-none"
                                        />
                                        <span className="text-[9px] text-theme-muted">min gap</span>
                                    </div>
                                    <p className="text-[9px] text-theme-muted leading-tight">
                                        Messages sent within <strong>{summaryOptions.groupingMinutes} minutes</strong> of each other act as one block.
                                    </p>
                                </div>

                                {/* 3. Participant Selection */}
                                <div className="space-y-2">
                                    <div className="text-xs font-semibold text-theme-main flex items-center gap-1.5 mb-1">
                                        <Users className="w-3 h-3 text-theme-muted" />
                                        Participants
                                    </div>
                                    <label className="flex items-center gap-2 p-1.5 rounded hover:bg-theme-hover cursor-pointer transition-colors border border-transparent hover:border-theme">
                                        <input 
                                            type="checkbox"
                                            checked={summaryOptions.includeOthers}
                                            onChange={(e) => setSummaryOptions({...summaryOptions, includeOthers: e.target.checked})}
                                            className="w-3.5 h-3.5 rounded border-theme bg-theme-base text-indigo-500 focus:ring-offset-0 focus:ring-1 focus:ring-indigo-500"
                                        />
                                        <span className="text-xs text-theme-main truncate">{selectedUser.name}</span>
                                    </label>
                                    <label className="flex items-center gap-2 p-1.5 rounded hover:bg-theme-hover cursor-pointer transition-colors border border-transparent hover:border-theme">
                                        <input 
                                            type="checkbox"
                                            checked={summaryOptions.includeMe}
                                            onChange={(e) => setSummaryOptions({...summaryOptions, includeMe: e.target.checked})}
                                            className="w-3.5 h-3.5 rounded border-theme bg-theme-base text-indigo-500 focus:ring-offset-0 focus:ring-1 focus:ring-indigo-500"
                                        />
                                        <span className="text-xs text-theme-main">Me</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsLocalSearchOpen(!isLocalSearchOpen)}
                        className={`p-2 rounded transition-colors ${isLocalSearchOpen ? 'bg-blue-500/20 text-blue-400' : 'text-theme-muted hover:text-theme-main hover:bg-theme-hover'}`}
                        title="Search in conversation"
                    >
                        <Search className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setIsGalleryOpen(!isGalleryOpen)}
                        className={`p-2 rounded transition-colors ${isGalleryOpen ? 'bg-blue-500/20 text-blue-400' : 'text-theme-muted hover:text-theme-main hover:bg-theme-hover'}`}
                        title="Toggle Shared Media"
                    >
                        <FolderOpen className="w-4 h-4" />
                    </button>
                    </div>
                </div>
            </div>

            {/* AI Summary Panel */}
            {summary && (
                <div className="border-t border-theme bg-theme-panel/80 backdrop-blur px-6 py-4 animate-in slide-in-from-top-2 relative">
                    <div className="flex items-start gap-4">
                        <div className="bg-indigo-500/10 p-2 rounded-lg border border-indigo-500/20 flex-shrink-0">
                            <Sparkles className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-bold text-theme-main">Conversation Summary</h3>
                                <button onClick={() => setSummary(null)} className="text-theme-muted hover:text-theme-main">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="markdown-content text-sm text-theme-main max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {summary}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </header>

        {/* Message Graph Area */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto pt-6 pb-4 scroll-smooth"
          >
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
                  searchTerm={isLocalSearchOpen ? localSearchQuery : searchQuery}
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

      <MediaGallery 
        isOpen={isGalleryOpen} 
        onClose={() => setIsGalleryOpen(false)} 
        messages={userMessages} 
        onImageClick={setLightboxImage}
        onDocView={handleDocumentAction}
      />

      <Lightbox 
        attachment={lightboxImage} 
        onClose={() => setLightboxImage(null)} 
      />

      <PDFViewer 
        attachment={activePDF} 
        onClose={() => setActivePDF(null)} 
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentTheme={theme}
        onSetTheme={setTheme}
        whatsapp={whatsapp}
      />

    </div>
  );
};

export default App;
