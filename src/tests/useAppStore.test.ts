import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../store/useAppStore';
import { USERS } from '../../constants';

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset state before each test if necessary
    const store = useAppStore.getState();
    store.setUsers(USERS);
    store.setSelectedUser(USERS[0] || null);
  });

  it('should initialize with default state', () => {
    const state = useAppStore.getState();
    expect(state.users).toBeDefined();
    expect(state.theme).toBe('dark');
  });

  it('should update theme', () => {
    const store = useAppStore.getState();
    store.setTheme('light');
    expect(useAppStore.getState().theme).toBe('light');
  });
});
