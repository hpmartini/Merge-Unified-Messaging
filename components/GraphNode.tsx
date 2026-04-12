
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, Platform, User, Attachment } from '../types';
import { PLATFORM_CONFIG } from '../constants';
import { CornerUpLeft, GitMerge, FileText, Download, ZoomIn, Paperclip, ChevronDown, ChevronUp, Search, Eye, Play, Volume2, MessagesSquare, Check, CheckCheck, SmilePlus } from 'lucide-react';
import AudioWaveform from './AudioWaveform';
import EmojiPicker from './EmojiPicker';

interface GraphNodeProps {
  message: Message;
  activePlatforms: Platform[]; // The user's total active platforms (columns)
  visiblePlatforms: Set<Platform>; // Which are currently checked in filter
  onReply: (message: Message) => void;
  user: User;
  onImageClick: (attachment: Attachment) => void;
  onDocView?: (attachment: Attachment) => void;
  isTargeted?: boolean;
  searchTerm?: string;
  singleChannel?: boolean; // Hide rails/dots when only one channel
}

const GraphNode: React.FC<GraphNodeProps> = ({
  message,
  activePlatforms,
  visiblePlatforms,
  onReply,
  user,
  onImageClick,
  onDocView,
  isTargeted,
  searchTerm,
  singleChannel = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);
  
  const config = PLATFORM_CONFIG[message.platform];
  const dateStr = message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  // Calculate rail column index
  const railIndex = activePlatforms.indexOf(message.platform);
  
  const handleReactionSelect = async (emoji: string) => {
    setShowEmojiPicker(false);
    try {
      await fetch(`/api/messages/${message.id}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji })
      });
      // Reaction state will be updated via websocket
    } catch (err) {
      console.error('Failed to react', err);
    }
  };

  // Effects
  useEffect(() => {
    if (isTargeted && nodeRef.current) {
      nodeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isTargeted]);

  // If this platform is filtered out, return null
  if (!visiblePlatforms.has(message.platform)) return null;

  // Rail configuration
  const RAIL_WIDTH = 24; // Width of each rail lane in px
  const LEFT_PADDING = 24;
  const railX = LEFT_PADDING + (railIndex * RAIL_WIDTH) + (RAIL_WIDTH/2);
  const isMe = message.isMe;

  // Vertical alignment for the dot and connector:
  const TOP_OFFSET = 28; 

  // --- Merge Calculation ---
  let mergePath = null;
  const isCrossChannelReply = message.replyToPlatform && message.replyToPlatform !== message.platform;
  
  if (isCrossChannelReply && visiblePlatforms.has(message.replyToPlatform!)) {
    const sourceRailIndex = activePlatforms.indexOf(message.replyToPlatform!);
    const sourceX = LEFT_PADDING + (sourceRailIndex * RAIL_WIDTH) + (RAIL_WIDTH/2);
    const targetX = railX;
    
    // Create a Bezier curve simulating a git merge from Source Rail to Target Dot
    const controlY = TOP_OFFSET * 0.6; // Control point vertical position
    
    mergePath = (
      <path
        d={`M ${sourceX} -10 C ${sourceX} ${controlY}, ${targetX} ${controlY}, ${targetX} ${TOP_OFFSET}`}
        fill="none"
        stroke={PLATFORM_CONFIG[message.replyToPlatform!].lineColor}
        strokeWidth="1.5"
        strokeDasharray="3 2"
        className="opacity-60"
      />
    );
  }

  const attachments = message.attachments || [];
  const imageAttachments = attachments.filter(a => a.type === 'image' && a.mediaType !== 'video');
  const videoAttachments = attachments.filter(a => a.mediaType === 'video');
  const audioAttachments = attachments.filter(a => a.mediaType === 'audio');
  const docAttachments = attachments.filter(a => a.type === 'document' && a.mediaType !== 'audio');

  // Markdown rendering customization to support search highlighting
  const MarkdownComponents = {
    p: ({ children }: any) => {
      if (typeof children === 'string' && searchTerm && searchTerm.trim()) {
        const parts = children.split(new RegExp(`(${searchTerm})`, 'gi'));
        return (
          <p>
            {parts.map((part, i) => (
              part.toLowerCase() === searchTerm.toLowerCase() 
                ? <mark key={i} className="bg-blue-500/40 text-blue-100 rounded-sm px-0.5">{part}</mark> 
                : part
            ))}
          </p>
        );
      }
      return <p>{children}</p>;
    }
  };

  return (
    <div 
      ref={nodeRef}
      className={`flex group relative w-full hover:bg-theme-hover transition-all min-h-[80px] ${isTargeted ? 'bg-blue-600/5' : ''}`}
    >
      
      {/* 1. Rails Area - hidden when only one channel */}
      {!singleChannel && (
        <div
          className="relative flex-shrink-0"
          style={{ width: `${activePlatforms.length * RAIL_WIDTH + LEFT_PADDING}px` }}
        >
          {/* Connector Line */}
          <div
            className="absolute h-px bg-slate-500/20"
            style={{
              top: `${TOP_OFFSET}px`,
              left: `${railX}px`,
              right: 0,
            }}
          />

          {/* Vertical Rails */}
          {activePlatforms.map((platform, idx) => {
            if (!visiblePlatforms.has(platform)) return null;
            return (
              <div
                key={platform}
                className="absolute top-0 bottom-0 border-l border-dashed opacity-20"
                style={{
                  left: `${LEFT_PADDING + (idx * RAIL_WIDTH) + (RAIL_WIDTH/2)}px`,
                  borderColor: PLATFORM_CONFIG[platform].lineColor,
                  borderWidth: '1px'
                }}
              />
            );
          })}

          {/* Merge Path */}
          {mergePath && (
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible">
              {mergePath}
            </svg>
          )}

          {/* The Commit Dot */}
          <div
            className={`absolute -translate-y-1/2 z-10 transition-all ${isTargeted ? 'scale-150' : 'group-hover:scale-110'}`}
            style={{
              left: `${railX - 5}px`,
              top: `${TOP_OFFSET}px`
            }}
          >
            <div
              className={`w-2.5 h-2.5 rounded-full ${config.bgColor} ring-4 ring-theme-base shadow-sm ${isTargeted ? 'animate-pulse ring-blue-500/50' : ''}`}
            />
          </div>
        </div>
      )}

      {/* 2. Message Content Area - Adjusted padding for mobile */}
      <div className={`flex-1 min-w-0 px-2 md:pl-4 md:pr-6 py-2 flex relative ${isMe ? 'justify-end' : 'justify-start'}`}>

        {/* Horizontal Guide Line - hidden when only one channel */}
        {!singleChannel && (
          <div
            className="absolute left-0 right-0 h-px bg-slate-500/10 -z-10"
            style={{ top: `${TOP_OFFSET}px` }}
          />
        )}

        {/* Adjusted Gap and Max Width for Mobile */}
        <div className={`flex gap-2 md:gap-3 max-w-[95%] md:max-w-[75%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>

           {/* Avatar - Smaller on mobile */}
           {!isMe && (
             <div className="flex-shrink-0 mt-5">
                <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full border flex items-center justify-center text-[10px] md:text-xs font-bold shadow-sm transition-colors ${isTargeted ? 'bg-blue-600 text-white border-blue-400' : 'bg-theme-panel border-theme text-theme-muted'}`}>
                    {user.avatarInitials}
                </div>
             </div>
           )}

           <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} min-w-0 flex-1`}>
              {/* Metadata Row */}
              <div className={`
                  flex items-center gap-2 mb-1 text-[10px] font-mono text-theme-muted uppercase tracking-wider group/meta
                  ${isMe ? 'flex-row-reverse text-right' : 'flex-row'}
              `}>
                 <span className={`px-1.5 py-0.5 rounded bg-theme-panel border border-theme ${config.color} font-bold`}>
                   {config.label}
                 </span>
                 <span className="text-theme-muted">/</span>
                 <span className={isTargeted ? 'text-blue-400 font-bold' : ''}>{dateStr}</span>
                 
                 {isMe && message.status === 'sent' && <Check className="w-3.5 h-3.5 text-theme-muted" title="Sent" aria-label="Sent" role="img" />}
                 {isMe && message.status === 'delivered' && <CheckCheck className="w-3.5 h-3.5 text-theme-muted" title="Delivered" aria-label="Delivered" role="img" />}
                 {isMe && message.status === 'read' && <CheckCheck className="w-3.5 h-3.5 text-blue-500" title="Read" aria-label="Read" role="img" />}

                 {isTargeted && <Search className="w-3 h-3 text-blue-500" />}

                 <div className="relative opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex items-center">
                   <button 
                     onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                     className="p-1 hover:bg-theme-hover rounded text-theme-muted hover:text-blue-400"
                     title="Add reaction"
                   >
                     <SmilePlus className="w-3 h-3" />
                   </button>
                   {showEmojiPicker && (
                     <EmojiPicker onSelect={handleReactionSelect} onClose={() => setShowEmojiPicker(false)} />
                   )}
                 </div>

                 <button 
                   onClick={() => onReply(message)}
                   className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-theme-hover rounded text-theme-muted hover:text-blue-400"
                   title="Reply to this message"
                 >
                   <CornerUpLeft className="w-3 h-3" />
                 </button>
              </div>

              {/* Bubble */}
              <div 
                className={`
                  relative rounded-lg p-3 text-sm shadow-sm border transition-all
                  ${isMe 
                    ? 'bg-theme-panel/60 border-theme rounded-tr-none text-right hover:border-slate-500/50' 
                    : 'bg-theme-panel border-theme rounded-tl-none text-left hover:border-slate-500/50'
                  }
                  ${isTargeted ? 'ring-2 ring-blue-500/50 border-blue-500/50 shadow-blue-900/20 shadow-lg' : ''}
                `}
              >
                  {/* Colored Accent Bar */}
                  <div 
                      className={`absolute top-[-1px] bottom-[-1px] w-1 ${config.bgColor} ${isMe ? 'right-[-1px] rounded-r' : 'left-[-1px] rounded-l'}`}
                  />

                  {/* Merge/Reply Context Header */}
                  {message.replyToId && (
                    <div className={`
                      mb-2 pb-2 border-b border-dashed border-slate-500/20 text-xs text-theme-muted flex items-center gap-2
                      ${isMe ? 'flex-row-reverse' : 'flex-row'}
                    `}>
                       {message.platform === Platform.Slack ? <MessagesSquare className="w-3 h-3 opacity-50" /> : <GitMerge className="w-3 h-3 opacity-50" />}
                       <span>
                          {isCrossChannelReply ? `Merged from ${message.replyToPlatform}` : (message.platform === Platform.Slack ? 'Thread reply' : 'Replied to')}
                       </span>
                       {message.replyToContent && (
                         <span className="italic truncate max-w-[150px] opacity-70">"{message.replyToContent}"</span>
                       )}
                    </div>
                  )}

                  {/* Email Subject Header */}
                  {(message.platform === Platform.Mail || message.platform === Platform.Email) && message.subject && (
                      <div className={`mb-2 pb-2 border-b border-slate-500/20 font-bold text-theme-main break-words ${isMe ? 'text-right' : 'text-left'}`}>
                          {searchTerm ? (
                            <span>
                              {message.subject.split(new RegExp(`(${searchTerm})`, 'gi')).map((part, i) => (
                                part.toLowerCase() === searchTerm.toLowerCase() 
                                  ? <mark key={i} className="bg-blue-500/40 text-blue-100 rounded-sm px-0.5">{part}</mark> 
                                  : part
                              ))}
                            </span>
                          ) : message.subject}
                      </div>
                  )}

                  {/* Content (Markdown Enabled) - only show if there's text content */}
                  {message.content && (
                    <div className={`markdown-content leading-relaxed font-normal ${isMe ? 'text-theme-main' : 'text-theme-main'} overflow-x-auto max-w-full break-words whitespace-pre-wrap`}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={MarkdownComponents}
                        >
                          {message.content}
                        </ReactMarkdown>
                    </div>
                  )}

                  {/* Inline Media - Always visible (images, videos, audio) */}
                  {(imageAttachments.length > 0 || videoAttachments.length > 0 || audioAttachments.length > 0) && (
                    <div className={`${message.content ? 'mt-3' : ''} space-y-3`}>
                      {/* Images Grid */}
                      {imageAttachments.length > 0 && (
                        <div className={`grid ${imageAttachments.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                          {imageAttachments.map(att => (
                            <div
                              key={att.id}
                              className="rounded-md overflow-hidden border border-theme cursor-zoom-in relative group/img shadow-lg bg-theme-base"
                              onClick={() => onImageClick(att)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  onImageClick(att);
                                }
                              }}
                            >
                              <img src={att.url} alt={att.name} className="w-full h-auto object-cover max-h-[300px]" />
                              <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/40 transition-colors flex items-center justify-center">
                                <div className="p-2 bg-slate-900/80 rounded-full border border-white/20 opacity-0 group-hover/img:opacity-100 transition-all scale-75 group-hover/img:scale-100">
                                  <ZoomIn className="w-5 h-5 text-white" />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Videos */}
                      {videoAttachments.length > 0 && (
                        <div className="space-y-2">
                          {videoAttachments.map(att => (
                            <div key={att.id} className="rounded-md overflow-hidden border border-theme shadow-lg bg-black">
                              <video
                                src={att.url}
                                controls
                                className="w-full max-h-[300px]"
                                preload="metadata"
                              >
                                Your browser does not support the video tag.
                              </video>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Audio with Waveform */}
                      {audioAttachments.length > 0 && (
                        <div className="space-y-2">
                          {audioAttachments.map(att => (
                            <AudioWaveform key={att.id} src={att.url} isMe={isMe} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Documents - collapsible */}
                  {docAttachments.length > 0 && (
                    <div className={`${message.content || imageAttachments.length > 0 || videoAttachments.length > 0 || audioAttachments.length > 0 ? 'mt-3' : ''}`}>
                      {/* Attachment Toggle Button */}
                      <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        aria-expanded={isExpanded}
                        className={`
                          flex items-center gap-2 px-3 py-1.5 rounded-md border text-[10px] font-bold uppercase tracking-wider transition-all
                          ${isExpanded
                            ? 'bg-theme-base border-theme text-theme-main'
                            : 'bg-theme-base/40 border-theme text-theme-muted hover:text-theme-main hover:border-slate-500/50'
                          }
                          ${isMe ? 'ml-auto flex-row-reverse' : ''}
                        `}
                      >
                        <Paperclip className="w-3 h-3" />
                        <span>{isExpanded ? 'Hide' : 'Show'} Documents ({docAttachments.length})</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>

                      {/* Expanded Documents */}
                      {isExpanded && (
                        <div className="mt-3 space-y-2 animate-in fade-in zoom-in duration-200">

                          {/* Documents List */}
                          {docAttachments.length > 0 && (
                            <div className="space-y-2">
                              {docAttachments.map(att => (
                                <div key={att.id} className="flex items-center gap-3 p-2 bg-theme-base/60 rounded-md border border-theme group/doc transition-all hover:bg-theme-panel/80">
                                  <div className="w-8 h-8 rounded bg-theme-panel flex items-center justify-center flex-shrink-0 text-amber-500">
                                    <FileText className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[11px] font-bold text-theme-main truncate">{att.name}</div>
                                    <div className="text-[9px] text-theme-muted">{att.size}</div>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {att.name.toLowerCase().endsWith('.pdf') && onDocView && (
                                      <button 
                                        onClick={() => onDocView(att)}
                                        title={`View ${att.name}`}
                                        className="p-1.5 bg-theme-panel hover:bg-theme-hover hover:text-blue-400 rounded text-theme-muted transition-all"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <a 
                                      href={att.url}
                                      download={att.name}
                                      title={`Download ${att.name}`}
                                      className="p-1.5 bg-theme-panel hover:bg-theme-hover hover:text-blue-400 rounded text-theme-muted transition-all active:scale-90"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
              </div>

              {/* Reaction Badges */}
              {message.reactions && message.reactions.length > 0 && (
                <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                  {message.reactions.map((r, i) => (
                    <button 
                      key={i} 
                      className="flex items-center gap-1 bg-theme-panel border border-theme rounded-full px-2 py-0.5 text-[11px] hover:bg-theme-hover transition-colors"
                      onClick={() => handleReactionSelect(r.emoji)}
                      title={r.users.join(', ')}
                    >
                      <span>{r.emoji}</span>
                      <span className="text-theme-muted font-medium">{r.users.length}</span>
                    </button>
                  ))}
                </div>
              )}
           </div>
        </div>

      </div>
    </div>
  );
};

export default GraphNode;
