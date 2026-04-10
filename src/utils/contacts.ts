import { User } from '../../types';

export const extractPhone = (str: string): string => {
  if (!str) return '';
  return str.replace(/\D/g, '');
};

export const normalizeName = (name: string): string => {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
};

export const isProperName = (name: string): boolean => {
  if (!name || !name.trim()) return false;
  const trimmed = name.trim();
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(trimmed)) return false;
  if (trimmed.length < 2) return false;
  return true;
};

export const isFuzzyNameMatch = (name1: string, name2: string): boolean => {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;
  
  if (n1.length > 5 && n2.includes(n1)) return true;
  if (n2.length > 5 && n1.includes(n2)) return true;
  
  const clean1 = n1.replace(/[^a-z0-9 ]/g, '');
  const clean2 = n2.replace(/[^a-z0-9 ]/g, '');
  
  const parts1 = clean1.split(' ');
  const parts2 = clean2.split(' ');
  
  if (parts1.length >= 2 && parts2.length >= 2) {
    if (parts1[0] === parts2[0]) {
      const last1 = parts1[parts1.length - 1];
      const last2 = parts2[parts2.length - 1];
      if (last1 && last2 && (last1.startsWith(last2) || last2.startsWith(last1))) {
        return true;
      }
    }
  }
  
  return false;
};

export const isGroupOrUnknown = (id: string, name: string): boolean => {
  // Simple heuristic for groups
  if (id.includes('group') || name.toLowerCase().includes('group')) return true;
  return false;
};

export const isSameContact = (existing: User, newUser: {name: string, id: string}) => {
  // Do not merge groups or system ids
  if (existing.id.includes('group') || newUser.id.includes('group')) {
    // only merge if it's the exact same group id
    return existing.id === newUser.id || (existing.alternateIds && existing.alternateIds.includes(newUser.id));
  }

  if (isFuzzyNameMatch(existing.name, newUser.name)) return true;

  const p1 = extractPhone(existing.id);
  const p2 = extractPhone(newUser.id);
  
  if (p1.length > 7 && p2.length > 7) {
    if (p1.endsWith(p2) || p2.endsWith(p1) || p1 === p2) return true;
  }
  
  if (existing.alternateIds) {
    for (const altId of existing.alternateIds) {
       const pAlt = extractPhone(altId);
       if (pAlt.length > 7 && p2.length > 7 && (pAlt.endsWith(p2) || p2.endsWith(pAlt))) return true;
    }
  }
  
  return false;
};
