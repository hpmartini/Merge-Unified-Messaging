import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { GitBranch, Search, X, Settings } from 'lucide-react';
import { Message } from '../../types';
import { UserList } from './SidebarComponents/UserList';
import { MessageSearchResults } from './SidebarComponents/MessageSearchResults';

const Sidebar: React.FC = () => {
  const { 
    users, 
    selectedUser, 
    setSelectedUser, 
    messages,
    globalSearchQuery,
    setGlobalSearchQuery,
    setIsSettingsOpen,
    setShowMobileChat,
    setTargetMessageId,
    visiblePlatforms,
    setVisiblePlatforms
  } = useAppStore();

  // Sort users by last message time (most recent first)
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const aTime = a.lastMessageTime?.getTime() || 0;
      const bTime = b.lastMessageTime?.getTime() || 0;
      return bTime - aTime; // Most recent first
    });
  }, [users]);

  // Local input state for immediate UI feedback
  const [inputValue, setInputValue] = useState(globalSearchQuery);

  // Debounce: update parent searchQuery after 150ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setGlobalSearchQuery(inputValue);
    }, 150);
    return () => clearTimeout(timer);
  }, [inputValue, setGlobalSearchQuery]);

  // Sync local state if parent changes (e.g., clearing from outside)
  useEffect(() => {
    setInputValue(globalSearchQuery);
  }, [globalSearchQuery]);

  const isSearching = globalSearchQuery.trim().length > 0;

  // Filter users by name when searching
  const filteredUsers = useMemo(() => {
    if (!isSearching) return sortedUsers;
    const query = globalSearchQuery.toLowerCase();
    return sortedUsers.filter(u => u.name.toLowerCase().includes(query));
  }, [sortedUsers, globalSearchQuery, isSearching]);

  const globalSearchResults = useMemo(() => {
    if (!globalSearchQuery.trim()) return [];
    const query = globalSearchQuery.toLowerCase();
    return messages.filter(m =>
      m.content.toLowerCase().includes(query) ||
      (m.subject && m.subject.toLowerCase().includes(query))
    ).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [messages, globalSearchQuery]);

  const handleUserSelection = useCallback((u: any) => {
    setSelectedUser(u);
    setShowMobileChat(true);
  }, [setSelectedUser, setShowMobileChat]);

  const handleUserSelectionAndClearSearch = useCallback((u: any) => {
    setSelectedUser(u);
    setShowMobileChat(true);
    setGlobalSearchQuery('');
  }, [setSelectedUser, setShowMobileChat, setGlobalSearchQuery]);

  const handleSearchResultClick = useCallback((message: Message) => {
    const user = users.find(u => u.id === message.userId);
    if (user) {
      setTargetMessageId(message.id);
      setSelectedUser(user);
      const nextVisible = new Set(visiblePlatforms);
      nextVisible.add(message.platform);
      setVisiblePlatforms(nextVisible);
      setShowMobileChat(true);
    }
  }, [users, setTargetMessageId, setSelectedUser, visiblePlatforms, setVisiblePlatforms, setShowMobileChat]);

  const highlightText = useCallback((text: string, highlight: string) => {
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
  }, []);

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
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search contacts & messages..."
            className="w-full bg-theme-base border border-theme rounded-md py-2 pl-9 pr-9 text-sm text-theme-main focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-slate-500 transition-all"
          />
          {inputValue && (
            <button
              onClick={() => { setInputValue(''); setGlobalSearchQuery(''); }}
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
              <span className="text-[9px] bg-theme-base px-1.5 rounded-full">{sortedUsers.length}</span>
            </div>
            <UserList 
              users={sortedUsers} 
              selectedUser={selectedUser} 
              onSelectUser={handleUserSelection} 
            />
          </>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2">
            {/* Matching Contacts */}
            {filteredUsers.length > 0 && (
              <>
                <div className="px-4 pb-2 text-[10px] font-bold text-theme-muted uppercase tracking-widest mt-2 flex items-center justify-between">
                  <span>Contacts</span>
                  <span className="text-[9px] bg-green-600/20 text-green-400 border border-green-500/20 px-1.5 rounded-full">{filteredUsers.length}</span>
                </div>
                <UserList 
                  users={filteredUsers} 
                  selectedUser={selectedUser} 
                  onSelectUser={handleUserSelectionAndClearSearch} 
                  highlightText={highlightText}
                  searchQuery={globalSearchQuery}
                />
              </>
            )}

            {/* Message Search Results */}
            <div className="px-4 pb-2 text-[10px] font-bold text-theme-muted uppercase tracking-widest mt-2 flex items-center justify-between">
              <span>Messages</span>
              <span className="text-[9px] bg-blue-600/20 text-blue-400 border border-blue-500/20 px-1.5 rounded-full">{globalSearchResults.length}</span>
            </div>

            {globalSearchResults.length === 0 && filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <div className="w-12 h-12 rounded-full bg-theme-base flex items-center justify-center mb-4 border border-theme">
                  <Search className="w-6 h-6 text-theme-muted" />
                </div>
                <p className="text-sm text-theme-muted font-medium">No results found</p>
                <p className="text-xs text-theme-muted mt-1">Try searching for keywords, dates, or contact names</p>
              </div>
            ) : (
              <MessageSearchResults 
                results={globalSearchResults}
                users={users}
                onResultClick={handleSearchResultClick}
                highlightText={highlightText}
                searchQuery={globalSearchQuery}
              />
            )}
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="p-3 md:p-2 lg:p-3 border-t border-theme">
        <button
          onClick={() => setIsSettingsOpen(true)}
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
