import { isSameContact, isFuzzyNameMatch, extractPhone, isProperName } from './contacts';
import { User, Platform } from '../../types';

describe('contacts utils', () => {
  describe('isFuzzyNameMatch', () => {
    it('matches exact names', () => {
      expect(isFuzzyNameMatch('John Doe', 'John Doe')).toBe(true);
    });

    it('matches case insensitive and trimmed', () => {
      expect(isFuzzyNameMatch(' John DOE ', 'john doe')).toBe(true);
    });

    it('matches initial and full last name', () => {
      expect(isFuzzyNameMatch('John D.', 'John Doe')).toBe(true);
      expect(isFuzzyNameMatch('John Doe', 'John D')).toBe(true);
    });

    it('does not match different names', () => {
      expect(isFuzzyNameMatch('John Doe', 'Jane Doe')).toBe(false);
      expect(isFuzzyNameMatch('Alice', 'Bob')).toBe(false);
    });
  });

  describe('isSameContact', () => {
    const createUser = (id: string, name: string, alternateIds: string[] = []): User => ({
      id,
      name,
      avatarInitials: name.substring(0, 2).toUpperCase(),
      activePlatforms: [Platform.WhatsApp],
      alternateIds,
    });

    it('merges by fuzzy name match', () => {
      const existing = createUser('wa-123', 'John D.');
      expect(isSameContact(existing, { id: 'sig-456', name: 'John Doe' })).toBe(true);
    });

    it('merges by matching phone numbers', () => {
      const existing = createUser('wa-+1234567890', 'Unknown');
      expect(isSameContact(existing, { id: 'sig-1234567890', name: 'Alice' })).toBe(true);
    });

    it('does not merge different phone numbers with different names', () => {
      const existing = createUser('wa-1234567890', 'Alice');
      expect(isSameContact(existing, { id: 'sig-0987654321', name: 'Bob' })).toBe(false);
    });

    it('does not crash on unknown or missing names/ids', () => {
      const existing = createUser('wa-11111111', '');
      expect(isSameContact(existing, { id: 'sig-22222222', name: '' })).toBe(false);
    });
    
    it('handles groups without crashing and avoids merging distinct groups', () => {
      const existingGroup = createUser('wa-group-123', 'Dev Team');
      expect(isSameContact(existingGroup, { id: 'sig-group-456', name: 'Design Team' })).toBe(false);
    });
  });
});
