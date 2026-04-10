import { useCallback } from 'react';
import { User, Message, Platform } from '../../types';
import { useAppStore } from '../store/useAppStore';
import { isSameContact, normalizeName } from '../utils/contacts';

export const useUnifiedChatState = () => {
  const { users, setUsers, messages, setMessages } = useAppStore();

  const mergeUsers = useCallback((newUsers: User[], platform: Platform) => {
    setUsers((prev: User[]) => {
      const mergedUsers = [...prev];
      const addedUsers: User[] = [];

      for (const u of newUsers) {
        const userToMerge = u;
        
        // 1. Exact ID match or alternate ID match
        const existingByIdIdx = mergedUsers.findIndex(existing => 
          existing.id === userToMerge.id || (existing.alternateIds || []).includes(userToMerge.id)
        );

        if (existingByIdIdx !== -1) {
          const existing = mergedUsers[existingByIdIdx];
          mergedUsers[existingByIdIdx] = {
            ...existing,
            avatarUrl: existing.avatarUrl || userToMerge.avatarUrl,
            lastMessageTime: userToMerge.lastMessageTime && (!existing.lastMessageTime || userToMerge.lastMessageTime > existing.lastMessageTime)
              ? userToMerge.lastMessageTime
              : existing.lastMessageTime
          };
          continue;
        }

        // 2. Intelligent merge match (by name/phone)
        const existingByNameIdx = mergedUsers.findIndex(existing => isSameContact(existing, userToMerge));

        if (existingByNameIdx !== -1) {
          const existing = mergedUsers[existingByNameIdx];
          if (!existing.activePlatforms.includes(platform)) {
            mergedUsers[existingByNameIdx] = {
              ...existing,
              activePlatforms: [...existing.activePlatforms, platform],
              avatarUrl: existing.avatarUrl || userToMerge.avatarUrl,
              alternateIds: [...(existing.alternateIds || []), userToMerge.id],
              lastMessageTime: userToMerge.lastMessageTime && (!existing.lastMessageTime || userToMerge.lastMessageTime > existing.lastMessageTime)
                ? userToMerge.lastMessageTime
                : existing.lastMessageTime,
              role: existing.role === 'Contact' ? existing.role : 'Contact'
            };
          }
        } else {
          addedUsers.push(userToMerge);
        }
      }

      return [...mergedUsers, ...addedUsers];
    });
  }, [setUsers]);

  const mergeMessages = useCallback((newMessages: Message[], fingerprintValidation?: boolean) => {
    setMessages((prev: Message[]) => {
      const existingIds = new Set(prev.map(m => m.id));
      
      let existingFingerprints: Set<string> | null = null;
      if (fingerprintValidation) {
        existingFingerprints = new Set(
          prev.map(m => `${m.content}|${m.isMe}|${Math.floor(m.timestamp.getTime() / 5000)}`)
        );
      }

      const uniqueNew = newMessages.filter(m => {
        if (existingIds.has(m.id)) return false;
        
        if (existingFingerprints) {
          const fp = `${m.content}|${m.isMe}|${Math.floor(m.timestamp.getTime() / 5000)}`;
          if (existingFingerprints.has(fp)) return false;
        }
        
        return true;
      });

      if (uniqueNew.length === 0) return prev;
      return [...prev, ...uniqueNew];
    });
  }, [setMessages]);

  return { mergeUsers, mergeMessages };
};
