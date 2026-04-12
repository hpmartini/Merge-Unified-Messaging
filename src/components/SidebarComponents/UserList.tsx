import React from 'react';
import { PLATFORM_CONFIG } from '../../../constants';
import { Hash } from 'lucide-react';
import { formatRelativeTime } from '../../utils/dateUtils';
import { User } from '../../../types';

interface UserListProps {
  users: User[];
  selectedUser: User | null;
  onSelectUser: (user: User) => void;
  highlightText?: (text: string, highlight: string) => React.ReactNode;
  searchQuery?: string;
}

export const UserList: React.FC<UserListProps> = ({
  users,
  selectedUser,
  onSelectUser,
  highlightText = (text) => text,
  searchQuery = ''
}) => {
  return (
    <ul className="md:px-1 lg:px-0 mb-4">
      {users.map(user => (
        <li key={user.id}>
          <button
            onClick={() => onSelectUser(user)}
            className={`w-full text-left px-3 py-3 md:px-0 md:py-2 lg:px-3 lg:py-3 rounded-md flex items-center gap-3 md:flex-col md:gap-1 lg:flex-row lg:gap-3 transition-all ${
              selectedUser?.id === user.id
                ? 'bg-theme-hover border-l-2 md:border-l-0 lg:border-l-2 border-blue-500'
                : 'hover:bg-theme-hover border-l-2 md:border-l-0 lg:border-l-2 border-transparent'
            }`}
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className={`w-10 h-10 rounded-full object-cover flex-shrink-0 ${
                  selectedUser?.id === user.id ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-theme-panel' : ''
                }`}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-inner flex-shrink-0 ${user.avatarUrl ? 'hidden' : ''} ${
               selectedUser?.id === user.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'bg-theme-base border border-theme text-theme-main'
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
                <span className="font-semibold text-theme-main truncate text-sm flex items-center gap-1">
                  {user.role === 'Slack Channel' && <Hash className="w-3.5 h-3.5 text-theme-muted" />}
                  {highlightText(user.name, searchQuery)}
                </span>
                {!searchQuery && user.lastMessageTime && (
                  <span className="text-[10px] text-theme-muted font-mono flex-shrink-0 ml-2">
                    {formatRelativeTime(user.lastMessageTime)}
                  </span>
                )}
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
  );
};