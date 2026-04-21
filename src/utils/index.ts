import type { User } from 'firebase/auth';
import type { UserData, UserClass } from '../types';
import { isAlumniEmail } from './emailUtils';
import { GSB_CLASS_NAMES } from '../data/names';

// This matches the logic in useAuthHelpers.ts for consistency
export const getUserDocumentId = (user: User, userData: UserData | null): string => {
    const email = user.email || '';

    // FIRST: Check if signed in with alumni email (not @stanford.edu)
    // This handles the case where admin signs in with alumni email
    if (isAlumniEmail(email) && userData) {
        // For alumni emails, use the uid from the loaded userData
        // This is the actual document ID we found during account linking
        return userData.uid;
    }

    // SECOND: Special handling for admin user with @stanford.edu
    if (user.email === 'jpark22@stanford.edu') {
        const userClass = userData?.userClass || 'gsb';
        return userClass === 'gsb' ? `${user.uid}_gsb` : `${user.uid}_undergrad`;
    }

    // DEFAULT: Regular user with @stanford.edu
    return user.uid;
};

export const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
};

export const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
};

export const getClassNames = (_userClass: UserClass): string[] => {
    return [...GSB_CLASS_NAMES].sort();
};