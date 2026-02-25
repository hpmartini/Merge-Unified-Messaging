
import React from 'react';
import { User, Platform, Message } from '../types';
import { PLATFORM_CONFIG } from '../constants';
import { GitBranch, Search, X, MessageSquare, Clock, Settings } from 'lucide-react';

interface SidebarProps {
  users: User[];
  selectedUser: User;
  onSelectUser: (user: User) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: Message[];
  onSearchResultClick: (message: Message) => void;
  onOpenSettings: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  users, 
  selectedUser, 
  onSelectUser,
  searchQuery,
  setSearchQuery,
  searchResults,
  onSearchResultClick,
  onOpenSettings
}) => {
  const isSearching = searchQuery.trim().length > 0;

  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return text;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => (
          <span 
            key={i} 
            className={part.toLowerCase() === highlight.toLowerCase() ? 'bg-blue-500/40 text-blue-100 rounded-sm' : ''}
          >
            {part}
          </span>
        ))}
      </span>
    );
  };

  return (
    <div className="w-full md:w-16 lg:w-80 bg-theme-panel border-r border-theme flex flex-col h-full flex-shrink-0 z-30 group/sidebar">
      {/* Header */}
      <div className="p-4 lg:p-4 md:p-2 border-b border-theme flex items-center gap-2 md:justify-center lg:justify-start">
        <GitBranch className="text-blue-500 w-6 h-6" />
        <span className="font-bold text-lg tracking-tight text-theme-main md:hidden lg:inline">Merge</span>
        <span className="text-xs bg-theme-base text-theme-muted px-2 py-0.5 rounded ml-auto border border-theme md:hidden lg:inline">v1.1.0</span>
      </div>

      {/* Search Bar - hidden in collapsed mode */}
      <div className="p-3 md:hidden lg:block">
        <div className="relative group">
          <Search className={`absolute left-3 top-2.5 w-4 h-4 transition-colors ${isSearching ? 'text-blue-500' : 'text-theme-muted'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search all messages..."
            className="w-full bg-theme-base border border-theme rounded-md py-2 pl-9 pr-9 text-sm text-theme-main focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-slate-500 transition-all"
          />
          {isSearching && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-theme-muted hover:text-theme-main transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable List Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {!isSearching ? (
          <>
            <div className="px-4 pb-2 text-[10px] font-bold text-theme-muted uppercase tracking-widest mt-2 flex items-center justify-between md:hidden lg:flex">
              <span>Contacts</span>
              <span className="text-[9px] bg-theme-base px-1.5 rounded-full">{users.length}</span>
            </div>
            <ul className="md:px-1 lg:px-0">
              {users.map(user => (
                <li key={user.id}>
                  <button
                    onClick={() => onSelectUser(user)}
                    className={`w-full text-left px-3 py-3 md:px-0 md:py-2 lg:px-3 lg:py-3 rounded-md flex items-center gap-3 md:flex-col md:gap-1 lg:flex-row lg:gap-3 transition-all ${
                      selectedUser.id === user.id
                        ? 'bg-theme-hover border-l-2 md:border-l-0 lg:border-l-2 border-blue-500'
                        : 'hover:bg-theme-hover border-l-2 md:border-l-0 lg:border-l-2 border-transparent'
                    }`}
                  >
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.name}
                        className={`w-10 h-10 rounded-full object-cover flex-shrink-0 ${
                          selectedUser.id === user.id ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-theme-panel' : ''
                        }`}
                        onError={(e) => {
                          // Fallback to initials on error
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-inner flex-shrink-0 ${user.avatarUrl ? 'hidden' : ''} ${
                       selectedUser.id === user.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'bg-theme-base border border-theme text-theme-main'
                    }`}>
                      {user.avatarInitials}
                    </div>

                    {/* Platform dots - below avatar in collapsed mode */}
                    <div className="hidden md:flex lg:hidden items-center justify-center gap-1 mt-0.5">
                      {user.activePlatforms.slice(0, 4).map(p => (
                        <div
                          key={p}
                          className={`w-1.5 h-1.5 rounded-full ${PLATFORM_CONFIG[p].bgColor}`}
                          title={PLATFORM_CONFIG[p].label}
                        />
                      ))}
                    </div>

                    {/* Full info - hidden in collapsed mode */}
                    <div className="flex-1 min-w-0 md:hidden lg:block">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-theme-main truncate text-sm">{user.name}</span>
                        <span className="text-[10px] text-theme-muted font-mono">2m</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        {user.activePlatforms.slice(0, 3).map(p => (
                          <div
                            key={p}
                            className={`w-1.5 h-1.5 rounded-full ${PLATFORM_CONFIG[p].bgColor}`}
                            title={PLATFORM_CONFIG[p].label}
                          />
                        ))}
                        {user.activePlatforms.length > 3 && <span className="text-[9px] text-theme-muted">+{user.activePlatforms.length - 3}</span>}
                        <span className="text-[11px] text-theme-muted ml-1 truncate font-medium">{user.role}</span>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2">
            <div className="px-4 pb-2 text-[10px] font-bold text-theme-muted uppercase tracking-widest mt-2 flex items-center justify-between">
              <span>Search Results</span>
              <span className="text-[9px] bg-blue-600/20 text-blue-400 border border-blue-500/20 px-1.5 rounded-full">{searchResults.length}</span>
            </div>
            
            {searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <div className="w-12 h-12 rounded-full bg-theme-base flex items-center justify-center mb-4 border border-theme">
                  <Search className="w-6 h-6 text-theme-muted" />
                </div>
                <p className="text-sm text-theme-muted font-medium">No results found</p>
                <p className="text-xs text-theme-muted mt-1">Try searching for keywords, dates, or subject lines</p>
              </div>
            ) : (
              <ul>
                {searchResults.map(msg => {
                  const user = users.find(u => u.id === msg.userId);
                  const config = PLATFORM_CONFIG[msg.platform];
                  return (
                    <li key={msg.id} className="border-b border-theme last:border-0">
                      <button
                        onClick={() => onSearchResultClick(msg)}
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
            )}
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="p-3 md:p-2 lg:p-3 border-t border-theme">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-3 py-2 md:justify-center lg:justify-start text-sm font-medium text-theme-muted hover:text-theme-main hover:bg-theme-hover rounded-md transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span className="md:hidden lg:inline">Settings</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
