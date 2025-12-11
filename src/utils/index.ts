import type { User } from 'firebase/auth';
import type { UserData, UserClass } from '../types';
import { isAlumniEmail } from './emailUtils';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

// This matches the logic in useAuthHelpers.ts for consistency
export const getUserDocumentId = (user: User, userData: UserData | null): string => {
    // Special handling for admin user
    if (user.email === 'jpark22@stanford.edu' ||
        user.email === 'jamespark@alumni.stanford.edu' ||
        user.email === 'jamespark@alumni.gsb.stanford.edu') {
        const userClass = userData?.userClass || 'gsb';
        return userClass === 'gsb' ? `${user.uid}_gsb` : `${user.uid}_undergrad`;
    }

    // For alumni emails, use the userData.uid (the original document ID)
    const email = user.email || '';
    if (isAlumniEmail(email) && userData) {
        return userData.uid || user.uid;
    }

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

export const getClassNames = async (userClass: UserClass): Promise<string[]> => {
    try {
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);

        const names: string[] = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.userClass === userClass && data.name) {
                names.push(data.name);
            }
        });

        return names.sort();
    } catch (error) {
        console.error('Error fetching class names:', error);
        return [];
    }
};