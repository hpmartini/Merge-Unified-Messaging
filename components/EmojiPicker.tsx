import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, Smile, Dog, Utensils, Hash, Lamp } from 'lucide-react';

interface EmojiData {
  char: string;
  name: string;
  category: string;
}

const EMOJI_LIST: EmojiData[] = [
  { char: '😀', name: 'grinning', category: 'smileys' },
  { char: '😃', name: 'happy', category: 'smileys' },
  { char: '😄', name: 'smile', category: 'smileys' },
  { char: '😁', name: 'grin', category: 'smileys' },
  { char: '😂', name: 'joy', category: 'smileys' },
  { char: '🤣', name: 'rofl', category: 'smileys' },
  { char: '😊', name: 'blush', category: 'smileys' },
  { char: '😉', name: 'wink', category: 'smileys' },
  { char: '😍', name: 'heart eyes', category: 'smileys' },
  { char: '😘', name: 'kiss', category: 'smileys' },
  { char: '😋', name: 'yum', category: 'smileys' },
  { char: '😎', name: 'cool', category: 'smileys' },
  { char: '🥳', name: 'party', category: 'smileys' },
  { char: '🤔', name: 'think', category: 'smileys' },
  { char: '🤨', name: 'raised eyebrow', category: 'smileys' },
  { char: '😐', name: 'neutral', category: 'smileys' },
  { char: '😑', name: 'expressionless', category: 'smileys' },
  { char: '🙄', name: 'rolling eyes', category: 'smileys' },
  { char: '❤️', name: 'red heart', category: 'symbols' },
  { char: '🔥', name: 'fire', category: 'symbols' },
  { char: '✨', name: 'sparkles', category: 'symbols' },
  { char: '💯', name: 'hundred', category: 'symbols' },
  { char: '🚀', name: 'rocket', category: 'symbols' },
  { char: '✅', name: 'check', category: 'symbols' },
  { char: '🐶', name: 'dog', category: 'animals' },
  { char: '🐱', name: 'cat', category: 'animals' },
  { char: '🦄', name: 'unicorn', category: 'animals' },
  { char: '🍕', name: 'pizza', category: 'food' },
  { char: '☕', name: 'coffee', category: 'food' },
  { char: '🍺', name: 'beer', category: 'food' },
  { char: '💻', name: 'laptop', category: 'objects' },
  { char: '💡', name: 'idea', category: 'objects' },
  { char: '🛠️', name: 'tools', category: 'objects' },
];

const CATEGORIES = [
  { id: 'smileys', icon: Smile, label: 'Smileys' },
  { id: 'symbols', icon: Hash, label: 'Symbols' },
  { id: 'animals', icon: Dog, label: 'Animals' },
  { id: 'food', icon: Utensils, label: 'Food' },
  { id: 'objects', icon: Lamp, label: 'Objects' },
];

interface EmojiPickerProps {
  onSelect: (char: string) => void;
  onClose: () => void;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect, onClose }) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('smileys');
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const filteredEmojis = useMemo(() => {
    if (search.trim()) {
      return EMOJI_LIST.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));
    }
    return EMOJI_LIST.filter(e => e.category === activeCategory);
  }, [search, activeCategory]);

  return (
    <div ref={pickerRef} className="absolute bottom-full right-0 mb-3 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-[100] flex flex-col animate-in zoom-in duration-200">
      <div className="p-2 border-b border-slate-800 bg-slate-950/50">
        <div className="relative">
          <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-slate-500" />
          <input
            autoFocus
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full bg-slate-900 border border-slate-700 rounded-md py-1.5 pl-7 pr-7 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="flex items-center justify-around p-1 bg-slate-900 border-b border-slate-800">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`p-2 rounded-md transition-colors ${activeCategory === cat.id ? 'text-blue-500 bg-blue-500/10' : 'text-slate-500 hover:text-slate-300'}`}
            title={cat.label}
            aria-label={cat.label}
            aria-pressed={activeCategory === cat.id}
          >
            <cat.icon className="w-4 h-4" />
          </button>
        ))}
      </div>

      <div className="h-48 overflow-y-auto p-2 grid grid-cols-6 gap-1 custom-scrollbar">
        {filteredEmojis.map((emoji, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(emoji.char)}
            className="w-8 h-8 flex items-center justify-center text-lg hover:bg-slate-800 rounded-md transition-all active:scale-90"
            title={emoji.name}
            aria-label={emoji.name}
          >
            {emoji.char}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EmojiPicker;