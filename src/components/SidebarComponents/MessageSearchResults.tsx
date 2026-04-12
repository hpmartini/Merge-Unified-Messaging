import React, { useMemo, memo } from 'react';
import { PLATFORM_CONFIG } from '../../../constants';
import { Clock } from 'lucide-react';
import { Message, User } from '../../../types';

interface MessageSearchResultsProps {
  results: Message[];
  users: User[];
  onResultClick: (message: Message) => void;
  highlightText: (text: string, highlight: string) => React.ReactNode;
  searchQuery: string;
}

export const MessageSearchResults: React.FC<MessageSearchResultsProps> = memo(({
  results,
  users,
  onResultClick,
  highlightText,
  searchQuery
}) => {
  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach(u => map.set(u.id, u));
    return map;
  }, [users]);

  if (results.length === 0) {
    return (
      <div className="px-4 py-4 text-xs text-theme-muted text-center">
        No messages found
      </div>
    );
  }

  return (
    <ul>
      {results.map(msg => {
        const user = userMap.get(msg.userId);
        const config = PLATFORM_CONFIG[msg.platform];
        return (
          <li key={msg.id} className="border-b border-theme last:border-0">
            <button
              onClick={() => onResultClick(msg)}
              className="w-full text-left px-4 py-4 hover:bg-theme-hover transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-theme-base flex items-center justify-center text-[10px] font-bold text-theme-main border border-theme">
                      {user?.avatarInitials}
                    </div>
                  )}
                  <span className="text-xs font-bold text-theme-main group-hover:text-blue-400 transition-colors">
                    {user?.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-theme-base border border-theme ${config.color}`}>
                    {config.label}
                  </span>
                </div>
              </div>
              <div className="text-[11px] text-theme-muted leading-relaxed line-clamp-2">
                {msg.subject && (
                   <div className="text-theme-main font-bold mb-0.5 truncate italic">
                     {highlightText(msg.subject, searchQuery)}
                   </div>
                )}
                {highlightText(msg.content, searchQuery)}
              </div>
              <div className="mt-2 flex items-center gap-2 text-[9px] text-theme-muted font-mono">
                 <Clock className="w-3 h-3" />
                 {msg.timestamp.toLocaleDateString()} {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                 <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 font-bold">VIEW →</span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
});

MessageSearchResults.displayName = 'MessageSearchResults';
