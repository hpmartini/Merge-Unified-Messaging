import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Message, Platform } from '../../types';
import { PLATFORM_CONFIG } from '../../constants';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Share2, Filter, MessagesSquare, FolderOpen, Search, ChevronUp, ChevronDown, X, Bot, Sparkles, Loader2, ArrowLeft, Clock, Users, Hash } from 'lucide-react';

interface ProfileProps {
  userMessages: Message[];
  isLocalSearchOpen: boolean;
  setIsLocalSearchOpen: (isOpen: boolean) => void;
  localSearchQuery: string;
  setLocalSearchQuery: (query: string) => void;
  currentMatchIndex: number;
  setCurrentMatchIndex: (index: number) => void;
  localMatches: Message[];
  navigateLocalMatch: (direction: 'next' | 'prev') => void;
}

export const Profile: React.FC<ProfileProps> = ({
  userMessages,
  isLocalSearchOpen,
  setIsLocalSearchOpen,
  localSearchQuery,
  setLocalSearchQuery,
  currentMatchIndex,
  setCurrentMatchIndex,
  localMatches,
  navigateLocalMatch
}) => {
  const { selectedUser, visiblePlatforms, setVisiblePlatforms, isGalleryOpen, setIsGalleryOpen, setShowMobileChat, targetMessageId, setTargetMessageId, summary, setSummary } = useAppStore();

  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryOptions, setSummaryOptions] = useState({
    blockLimit: 1, // Number of "conversation blocks" to summarize
    groupingMinutes: 5, // Minutes between messages to count as one block
    includeOthers: true,
    includeMe: true
  });
  const localSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLocalSearchOpen && localSearchInputRef.current) {
      localSearchInputRef.current.focus();
    }
  }, [isLocalSearchOpen]);

  const togglePlatform = (p: Platform) => {
    const next = new Set(visiblePlatforms);
    if (next.has(p)) {
      next.delete(p);
    } else {
      next.add(p);
    }
    setVisiblePlatforms(next);
  };

  const handleSummarize = async () => {
    if (!process.env.API_KEY) {
        console.error("API Key not found");
        return;
    }
    if (isSummarizing) return;

    if (!selectedUser) return;

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
        relevantMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        
        const groups: Message[][] = [];
        if (relevantMessages.length > 0) {
            let currentGroup = [relevantMessages[0]];
            
            for (let i = 1; i < relevantMessages.length; i++) {
                const prev = relevantMessages[i-1];
                const curr = relevantMessages[i];
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

  if (!selectedUser) return null;

  return (
    <header className="min-h-14 border-b border-theme bg-theme-panel/50 backdrop-blur flex flex-col justify-center flex-shrink-0 z-10 transition-all">
        <div className="flex items-center px-6 h-14 justify-between w-full">
            <div className="flex items-center gap-3 flex-1">
                <button
                    onClick={() => setShowMobileChat(false)}
                    className="md:hidden p-1 -ml-2 mr-2 text-theme-muted hover:text-theme-main rounded-full hover:bg-theme-hover transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>

                {!isLocalSearchOpen ? (
                <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                    <Share2 className="w-5 h-5 text-theme-muted" />
                    <span className="font-sans text-theme-main font-bold text-lg flex items-center gap-1.5">
                        {selectedUser.role === 'Slack Channel' && <Hash className="w-5 h-5 text-theme-muted" />}
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
                <div className="relative group">
                    <button
                        onClick={handleSummarize}
                        disabled={isSummarizing}
                        className={`p-2 rounded transition-colors ${isSummarizing || summary ? 'bg-indigo-500/20 text-indigo-400' : 'text-theme-muted hover:text-indigo-400 hover:bg-theme-hover'}`}
                    >
                        {isSummarizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                    </button>

                    <div className="absolute right-0 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                        <div 
                            className="w-72 backdrop-blur-[100px] border border-theme/20 rounded-2xl shadow-2xl p-5 origin-top-right ring-1 ring-white/5"
                            style={{ backgroundColor: 'color-mix(in srgb, var(--bg-panel), transparent 15%)' }}
                        >
                            <h4 className="text-[10px] font-bold text-theme-muted uppercase tracking-wider mb-4 border-b border-theme/50 pb-2 flex items-center gap-2">
                                <Sparkles className="w-3 h-3 text-indigo-400" />
                                Summary Config
                            </h4>
                            
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
  );
};
