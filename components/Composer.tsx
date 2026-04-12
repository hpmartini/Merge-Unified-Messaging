
import React, { useState, useRef, useEffect } from 'react';
import { User, Platform, Message, Attachment } from '../types';
import { PLATFORM_CONFIG } from '../constants';
import EmojiPicker from './EmojiPicker';
import { GoogleGenAI } from "@google/genai";
import { 
  Send, ChevronDown, X, CornerUpLeft, 
  Bold, Italic, Code, List, 
  Paperclip, Loader2, FileText, Smile, Sparkles, Wand2
} from 'lucide-react';

interface ComposerProps {
  selectedUser: User;
  onSendMessage: (content: string, platform: Platform, attachments?: Attachment[]) => void;
  replyingTo: Message | null;
  onCancelReply: () => void;
  draftAttachments: Attachment[];
  onRemoveAttachment: (id: string) => void;
  onAddFiles: (files: FileList | File[]) => void;
  isUploading: boolean;
}

// Utility to convert rich HTML content back to Markdown for sending
const htmlToMarkdown = (html: string) => {
  const temp = document.createElement('div');
  temp.innerHTML = html;

  function traverse(node: Node): string {
    if (node.nodeType === 3) return (node.textContent || '').replace(/\u200B/g, '');
    if (node.nodeType === 1) {
      const el = node as HTMLElement;
      let inner = '';
      el.childNodes.forEach(c => inner += traverse(c));
      
      switch (el.tagName.toLowerCase()) {
        case 'h1': return `# ${inner}\n\n`;
        case 'h2': return `## ${inner}\n\n`;
        case 'h3': return `### ${inner}\n\n`;
        case 'div': return `${inner}\n`;
        case 'p': return `${inner}\n`;
        case 'br': return `\n`;
        case 'b': case 'strong': return `**${inner}**`;
        case 'i': case 'em': return `_${inner}_`;
        case 'ul': return `${inner}\n`;
        case 'li': return `- ${inner}\n`;
        case 'code': return `\`${inner}\``;
        case 'blockquote': return `> ${inner}\n`;
        default: return inner;
      }
    }
    return '';
  }
  return traverse(temp).trim();
};

const Composer: React.FC<ComposerProps> = ({ 
  selectedUser, 
  onSendMessage, 
  replyingTo, 
  onCancelReply,
  draftAttachments,
  onRemoveAttachment,
  onAddFiles,
  isUploading
}) => {
  // Use a ref for the visual editor
  const editorRef = useRef<HTMLDivElement>(null);
  // Keep raw text state for validation/send button status
  const [hasContent, setHasContent] = useState(false);
  
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>(selectedUser.activePlatforms[0]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isAIDropdownOpen, setIsAIDropdownOpen] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedUser.activePlatforms.includes(selectedPlatform)) {
      setSelectedPlatform(selectedUser.activePlatforms[0]);
    }
  }, [selectedUser, selectedPlatform]);

  const checkInlineFormatting = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    const { startContainer, startOffset } = range;

    if (startContainer.nodeType === 3) {
        const textContent = startContainer.textContent || '';
        const textBefore = textContent.slice(0, startOffset);

        // Bold: **text**
        const boldMatch = textBefore.match(/\*\*([^*]+)\*\*$/);
        // Italic: _text_
        const italicMatch = textBefore.match(/_([^_]+)_$/);

        let match = null;
        let tag = '';
        let innerText = '';

        if (boldMatch) {
            match = boldMatch;
            tag = 'b';
            innerText = boldMatch[1];
        } else if (italicMatch) {
            match = italicMatch;
            tag = 'i';
            innerText = italicMatch[1];
        }

        if (match) {
            const matchLength = match[0].length;

            const replaceRange = document.createRange();
            replaceRange.setStart(startContainer, startOffset - matchLength);
            replaceRange.setEnd(startContainer, startOffset);
            replaceRange.deleteContents();

            const el = document.createElement(tag);
            el.textContent = innerText;
            replaceRange.insertNode(el);

            // Insert zero-width space to step out of the formatted element
            const zeroWidthSpace = document.createTextNode('\u200B');
            replaceRange.setStartAfter(el);
            replaceRange.insertNode(zeroWidthSpace);

            const newRange = document.createRange();
            newRange.setStartAfter(zeroWidthSpace);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }
    }
  };

  const updateContentState = () => {
    checkInlineFormatting();
    if (editorRef.current) {
        setHasContent(editorRef.current.innerText.trim().length > 0);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editorRef.current) return;
    
    const markdownContent = htmlToMarkdown(editorRef.current.innerHTML);
    
    if (!markdownContent.trim() && draftAttachments.length === 0) return;
    
    onSendMessage(markdownContent, selectedPlatform, draftAttachments);
    
    // Reset editor
    editorRef.current.innerHTML = '';
    setHasContent(false);
    setIsEmojiPickerOpen(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(e.target.files);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Helper to get the direct child of editor from a node
  const getBlockParent = (node: Node | null) => {
    let curr = node;
    while (curr && curr.parentElement !== editorRef.current) {
      curr = curr.parentElement;
    }
    return curr as HTMLElement | null;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 1. ENTER (No Shift) -> SEND
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
        return;
    }

    // 2. SHIFT + ENTER -> New Line / Break out of Block
    if (e.key === 'Enter' && e.shiftKey) {
        const selection = window.getSelection();
        if (!selection?.rangeCount) return;
        const range = selection.getRangeAt(0);
        const block = getBlockParent(range.startContainer);

        if (block) {
            const tag = block.tagName.toLowerCase();
            
            // If in Header or Blockquote, break out to a new Div
            if (['h1', 'h2', 'h3', 'blockquote'].includes(tag)) {
                e.preventDefault();
                const newDiv = document.createElement('div');
                newDiv.innerHTML = '<br>'; // Placeholder for cursor
                
                if (block.nextSibling) {
                    editorRef.current?.insertBefore(newDiv, block.nextSibling);
                } else {
                    editorRef.current?.appendChild(newDiv);
                }

                // Move cursor to new div
                const newRange = document.createRange();
                newRange.setStart(newDiv, 0);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
                return;
            }

            // If in List Item, create new List Item
            if (tag === 'li' || (tag === 'ul')) {
                // If it's UL, we might be inside an LI text node
                // Default browser behavior for Shift+Enter in LI is sometimes soft break
                // We want a new bullet point to continue the list
                e.preventDefault();
                
                // Find the actual LI if we are deep
                let li = range.startContainer as HTMLElement;
                while (li && li.tagName !== 'LI' && li !== editorRef.current) {
                   if (li.parentElement) li = li.parentElement;
                   else break;
                }
                
                if (li && li.tagName === 'LI') {
                   const newLi = document.createElement('li');
                   newLi.innerHTML = '<br>';
                   if (li.nextSibling) li.parentNode?.insertBefore(newLi, li.nextSibling);
                   else li.parentNode?.appendChild(newLi);
                   
                   const newRange = document.createRange();
                   newRange.setStart(newLi, 0);
                   newRange.collapse(true);
                   selection.removeAllRanges();
                   selection.addRange(newRange);
                   return;
                }
            }
        }
        // Default behavior (insert <br>) works for Divs/Paragraphs
    }

    // 3. SPACE -> Trigger Formatting (Blocks only)
    if (e.key === ' ') {
        const selection = window.getSelection();
        if (!selection?.rangeCount) return;
        const range = selection.getRangeAt(0);
        const { startContainer, startOffset } = range;

        // Ensure we are working with text
        if (startContainer.nodeType === 3) {
            const textContent = startContainer.textContent || '';
            const textBefore = textContent.slice(0, startOffset);
            
            // --- Block Triggers ---
            let tag = '';
            let triggerLen = 0;
            let isList = false;

            if (textBefore === '#') { tag = 'h1'; triggerLen = 1; }
            else if (textBefore === '##') { tag = 'h2'; triggerLen = 2; }
            else if (textBefore === '###') { tag = 'h3'; triggerLen = 3; }
            else if (textBefore === '>') { tag = 'blockquote'; triggerLen = 1; }
            else if (textBefore === '-' || textBefore === '*') { tag = 'ul'; triggerLen = 1; isList = true; }

            if (tag) {
                const block = getBlockParent(startContainer);
                // Only trigger if we are at the start of the block content or essentially empty
                // But check if the textBefore matches start
                if (block && textContent.startsWith(textBefore)) {
                    e.preventDefault();

                    // 1. Clean the text node (remove trigger chars)
                    const textNode = startContainer;
                    textNode.textContent = textContent.slice(triggerLen);

                    // 2. Transform
                    if (isList) {
                         document.execCommand('insertUnorderedList');
                    } else {
                         // Manual Block Transform
                         const newEl = document.createElement(tag);
                         
                         // Move children
                         while (block.firstChild) {
                             newEl.appendChild(block.firstChild);
                         }
                         
                         // Ensure it's not collapsed
                         if (!newEl.textContent?.trim() && !newEl.querySelector('br')) {
                            newEl.appendChild(document.createElement('br'));
                         }

                         block.replaceWith(newEl);

                         // Restore Cursor
                         const newRange = document.createRange();
                         // If textNode is still there (it moved), use it
                         if (newEl.contains(textNode)) {
                             newRange.setStart(textNode, 0);
                         } else {
                             // Fallback to start of new element
                             newRange.setStart(newEl, 0);
                         }
                         newRange.collapse(true);
                         selection.removeAllRanges();
                         selection.addRange(newRange);
                    }
                }
            }
        }
    }
    
    if (e.key === 'Escape') {
      setIsEmojiPickerOpen(false);
      setIsAIDropdownOpen(false);
    }
  };

  // --- AI Integration ---
  const handleAIAction = async (action: 'reply' | 'improve' | 'professional' | 'casual') => {
    setIsAIDropdownOpen(false);
    
    // Safety check for API Key
    if (!process.env.API_KEY) {
        console.warn("API Key is missing for AI features");
        return;
    }

    setIsGeneratingAI(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let prompt = '';
      const currentText = editorRef.current?.innerText || '';

      if (action === 'reply' && replyingTo) {
        prompt = `You are a helpful messaging assistant. 
        Context: I am replying to a message from ${selectedUser.name} on ${replyingTo.platform}.
        Their message: "${replyingTo.content}"
        Task: Draft a concise, friendly, and relevant reply.
        Tone: Professional yet friendly.
        Output Format: Return ONLY valid HTML suitable for a rich text editor (use <p>, <ul>, <li>, <b> tags). Do not use markdown code blocks.`;
      } else {
        if (!currentText) { setIsGeneratingAI(false); return; }
        switch(action) {
            case 'improve': prompt = `Rewrite this to fix grammar and clarity: "${currentText}". Output as simple HTML.`; break;
            case 'professional': prompt = `Make this text more professional: "${currentText}". Output as simple HTML.`; break;
            case 'casual': prompt = `Make this text more casual and friendly: "${currentText}". Output as simple HTML.`; break;
        }
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });

      const text = response.text;

      if (text && editorRef.current) {
        // Clean up markdown code blocks if the model includes them
        let cleanText = text.replace(/^```html/, '').replace(/^```/, '').replace(/```$/, '');
        editorRef.current.innerHTML = cleanText.trim();
        updateContentState();
        
        // Focus and move cursor to end
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        editorRef.current.focus();
      }
    } catch (error) {
      console.error("AI Generation failed", error);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const execCmd = (command: string, value: string | undefined = undefined) => {
      document.execCommand(command, false, value);
      editorRef.current?.focus();
  };

  const insertEmoji = (char: string) => {
      execCmd('insertText', char);
      setIsEmojiPickerOpen(false);
  };

  const currentConfig = PLATFORM_CONFIG[selectedPlatform];

  return (
    <div className="border-t border-theme bg-theme-panel p-4 sticky bottom-0 z-20 shadow-[0_-8px_30px_rgba(0,0,0,0.5)]">
      
      {/* Inline Styles for the Editable Area */}
      <style>{`
        .rich-editor h1 { font-size: 1.5em; font-weight: 700; color: var(--text-main); border-bottom: 1px solid var(--border); margin-top: 0.5em; margin-bottom: 0.25em; display: block; }
        .rich-editor h2 { font-size: 1.3em; font-weight: 700; color: var(--text-main); margin-top: 0.5em; margin-bottom: 0.25em; display: block; }
        .rich-editor h3 { font-size: 1.15em; font-weight: 700; color: var(--text-main); margin-top: 0.5em; margin-bottom: 0.25em; display: block; }
        .rich-editor ul { list-style-type: disc; padding-left: 1.5em; margin-bottom: 0.5em; }
        .rich-editor li { margin-bottom: 0.25em; }
        .rich-editor b, .rich-editor strong { color: #60a5fa; font-weight: 700; }
        .rich-editor i, .rich-editor em { font-style: italic; color: var(--text-muted); }
        .rich-editor blockquote { border-left: 3px solid #3b82f6; padding-left: 1rem; color: var(--text-muted); font-style: italic; display: block; }
        .rich-editor code { background: var(--bg-hover); padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
        .rich-editor:empty:before { content: attr(data-placeholder); color: var(--text-muted); pointer-events: none; display: block; }
      `}</style>

      <div className="max-w-4xl mx-auto flex flex-col gap-2 relative">
        
        {/* Attachment Previews */}
        {(draftAttachments.length > 0 || isUploading) && (
          <div className="flex flex-wrap gap-2 mb-2 animate-in fade-in zoom-in duration-200">
            {draftAttachments.map(att => (
              <div key={att.id} className="relative group">
                <div className="w-12 h-12 rounded-lg border border-theme bg-theme-base overflow-hidden shadow-lg relative">
                  {att.type === 'image' ? (
                    <img src={att.url} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><FileText className="w-5 h-5 text-blue-500" /></div>
                  )}
                  {att.isUploading && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
                      <div className="w-8 h-1.5 bg-gray-700 rounded-full overflow-hidden mb-1">
                        <div 
                          className="h-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${att.uploadProgress || 0}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-white font-bold">{att.uploadProgress || 0}%</span>
                    </div>
                  )}
                </div>
                {!att.isUploading && (
                  <button 
                    type="button" 
                    onClick={() => onRemoveAttachment(att.id)}
                    className="absolute -top-1.5 -right-1.5 bg-theme-panel border border-theme rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-theme-muted" />
                  </button>
                )}
              </div>
            ))}
            {isUploading && !draftAttachments.some(a => a.isUploading) && (
              <div className="w-12 h-12 rounded-lg border border-theme border-dashed flex items-center justify-center animate-pulse">
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
              </div>
            )}
          </div>
        )}

        {/* Reply Context */}
        {replyingTo && (
          <div className="flex items-center justify-between bg-theme-panel/50 border border-theme rounded-lg px-3 py-2 text-xs mb-1 animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-2 text-theme-muted overflow-hidden">
              <CornerUpLeft className="w-3 h-3 text-blue-500" />
              <span className="font-bold text-theme-muted">Replying to {selectedUser.name}</span>
              <span className="truncate italic text-theme-muted">"{replyingTo.content}"</span>
            </div>
            <div className="flex items-center gap-3">
               <button
                  type="button"
                  onClick={() => handleAIAction('reply')}
                  disabled={isGeneratingAI}
                  className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 transition-colors font-bold uppercase tracking-wider text-[10px]"
                  title="Auto-draft reply with AI"
               >
                  {isGeneratingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  <span>Magic Draft</span>
               </button>
               <button type="button" onClick={onCancelReply} className="text-theme-muted hover:text-theme-main"><X className="w-3 h-3" /></button>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="relative">
                <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest border border-theme bg-theme-base hover:border-slate-500 transition-all"
                >
                <div className={`w-1.5 h-1.5 rounded-full ${currentConfig.bgColor}`} />
                <span className={currentConfig.color}>{currentConfig.label}</span>
                <ChevronDown className="w-3 h-3 text-theme-muted" />
                </button>
                {isDropdownOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
                    <div className="absolute bottom-full left-0 mb-2 w-44 bg-theme-panel border border-theme rounded-lg shadow-2xl z-20 overflow-hidden animate-in zoom-in duration-150">
                    {selectedUser.activePlatforms.map(p => (
                        <button
                            key={p}
                            type="button"
                            onClick={() => { setSelectedPlatform(p); setIsDropdownOpen(false); }}
                            className="w-full text-left px-4 py-2 hover:bg-theme-hover flex items-center gap-2 text-sm"
                        >
                            <div className={`w-2 h-2 rounded-full ${PLATFORM_CONFIG[p].bgColor}`} />
                            <span className={PLATFORM_CONFIG[p].color}>{PLATFORM_CONFIG[p].label}</span>
                        </button>
                    ))}
                    </div>
                </>
                )}
            </div>
            
            {/* AI Assistant Button */}
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsAIDropdownOpen(!isAIDropdownOpen)}
                    disabled={isGeneratingAI}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 transition-all"
                >
                    {isGeneratingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    <span>AI Tools</span>
                </button>
                {isAIDropdownOpen && (
                    <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsAIDropdownOpen(false)} />
                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-theme-panel border border-theme rounded-lg shadow-2xl z-20 overflow-hidden animate-in zoom-in duration-150 py-1">
                        <div className="px-3 py-1 text-[9px] font-bold text-theme-muted uppercase tracking-wider">Refine Text</div>
                        <button
                            type="button"
                            onClick={() => handleAIAction('improve')}
                            disabled={!hasContent}
                            className="w-full text-left px-3 py-2 hover:bg-theme-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-xs text-theme-main"
                        >
                            <Sparkles className="w-3 h-3 text-blue-400" />
                            <span>Fix Grammar</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAIAction('professional')}
                            disabled={!hasContent}
                            className="w-full text-left px-3 py-2 hover:bg-theme-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-xs text-theme-main"
                        >
                            <Wand2 className="w-3 h-3 text-purple-400" />
                            <span>Make Professional</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAIAction('casual')}
                            disabled={!hasContent}
                            className="w-full text-left px-3 py-2 hover:bg-theme-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-xs text-theme-main"
                        >
                            <Smile className="w-3 h-3 text-amber-400" />
                            <span>Make Casual</span>
                        </button>
                    </div>
                    </>
                )}
            </div>
          </div>

          <div className="flex items-center gap-0.5 bg-theme-base/50 p-0.5 rounded-lg border border-theme">
            <button type="button" onClick={() => execCmd('bold')} className="p-1.5 hover:bg-theme-hover rounded text-theme-muted hover:text-theme-main transition-colors"><Bold className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => execCmd('italic')} className="p-1.5 hover:bg-theme-hover rounded text-theme-muted hover:text-theme-main transition-colors"><Italic className="w-3.5 h-3.5" /></button>
            <div className="w-px h-3.5 bg-theme-hover mx-1" />
            <button type="button" onClick={() => execCmd('insertUnorderedList')} className="p-1.5 hover:bg-theme-hover rounded text-theme-muted hover:text-theme-main transition-colors"><List className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => execCmd('formatBlock', 'H1')} className="p-1.5 hover:bg-theme-hover rounded text-theme-muted hover:text-theme-main transition-colors font-serif font-bold text-xs">H1</button>
          </div>
        </div>

        {/* Main Input Area */}
        <div className="flex items-end gap-2 group">
          <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileSelect} />
          
          <div className={`flex-1 relative flex items-end bg-theme-base border rounded-2xl transition-all shadow-inner ${isGeneratingAI ? 'border-indigo-500/50' : 'border-theme group-focus-within:border-blue-500/50'}`}>
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              className="p-3 text-theme-muted hover:text-blue-500 transition-colors"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* LIVE EDITABLE CONTENT DIV */}
            <div
                ref={editorRef}
                contentEditable={!isGeneratingAI}
                onInput={updateContentState}
                onKeyDown={handleKeyDown}
                data-placeholder={isGeneratingAI ? "AI is writing..." : `Message ${selectedUser.name}... (Try '# ' for Header, '- ' for List)`}
                className="rich-editor flex-1 bg-transparent text-theme-main py-3 pr-10 font-sans text-sm focus:outline-none min-h-[44px] max-h-60 overflow-y-auto disabled:opacity-50 break-words whitespace-pre-wrap"
                suppressContentEditableWarning={true}
            />

            <div className="absolute right-2 bottom-1.5">
              <button 
                type="button" 
                onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                className={`p-1.5 rounded-full transition-colors ${isEmojiPickerOpen ? 'bg-blue-500/20 text-blue-400' : 'text-theme-muted hover:text-amber-500 hover:bg-theme-hover'}`}
              >
                <Smile className="w-5 h-5" />
              </button>
              {isEmojiPickerOpen && (
                <EmojiPicker onSelect={insertEmoji} onClose={() => setIsEmojiPickerOpen(false)} />
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={(!hasContent && draftAttachments.length === 0) || isUploading || isGeneratingAI}
            className={`
              w-11 h-11 rounded-full flex items-center justify-center transition-all flex-shrink-0 shadow-lg active:scale-90
              ${(hasContent || draftAttachments.length > 0) && !isUploading && !isGeneratingAI
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40' 
                : 'bg-theme-hover text-theme-muted cursor-not-allowed'}
            `}
          >
            {isUploading || isGeneratingAI ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Composer;
