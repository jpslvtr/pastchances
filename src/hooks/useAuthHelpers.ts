import { useCallback } from 'react';
import type { User } from 'firebase/auth';
import type { MatchInfo, UserClass } from '../types/userTypes';

const DEFAULT_PROFILE_URL = '/files/default-profile.png';

export const useAuthHelpers = () => {
    const normalizeMatches = useCallback((matches: any[]): MatchInfo[] => {
        if (!matches || !Array.isArray(matches)) return [];

        return matches.map(match => {
            if (typeof match === 'string') {
                return {
                    name: match,
                    email: match.toLowerCase().replace(/\s+/g, '.') + '@stanford.edu'
                };
            } else if (match && typeof match === 'object' && match.name && match.email) {
                return {
                    name: match.name,
                    email: match.email,
                    matchedAt: match.matchedAt
                };
            } else {
                return {
                    name: 'Unknown',
                    email: 'unknown@stanford.edu'
                };
            }
        });
    }, []);

    const getUserDocumentId = useCallback((user: User, userClass: UserClass): string => {
        if (user.email === 'jpark22@stanford.edu' ||
            user.email === 'jamespark@alumni.stanford.edu' ||
            user.email === 'jamespark@alumni.gsb.stanford.edu') {
            return userClass === 'gsb' ? `${user.uid}_gsb` : `${user.uid}_undergrad`;
        }
        return user.uid;
    }, []);

    const getLastUsedClass = useCallback((): UserClass | null => {
        try {
            return localStorage.getItem('lastUsedClass') as UserClass | null;
        } catch {
            return null;
        }
    }, []);

    const setLastUsedClass = useCallback((userClass: UserClass) => {
        try {
            localStorage.setItem('lastUsedClass', userClass);
        } catch {
            // Ignore localStorage errors
        }
    }, []);

    return {
        normalizeMatches,
        getUserDocumentId,
        getLastUsedClass,
        setLastUsedClass
    };
};