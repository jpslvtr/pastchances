import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

export const getInitials = (name: string): string => {
    if (!name) return '?';

    const parts = name.trim().split(' ');
    // Just return the first letter of the first name
    return parts[0].charAt(0).toUpperCase();
};

export const generateInitialsColor = (name: string): string => {
    // Handle undefined, null, or empty string
    if (!name) {
        return 'hsl(0, 0%, 70%)'; // Default gray color for missing names
    }

    // Generate a consistent color based on name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    const hue = hash % 360;
    return `hsl(${hue}, 65%, 50%)`;
};

interface UserPhoto {
    photoURL?: string;
    customPhotoURL?: string;
}

export const getUserPhoto = async (name: string, userClass: string = 'gsb'): Promise<UserPhoto> => {
    try {
        if (!name) {
            return {};
        }

        const usersRef = collection(db, 'users');
        const q = query(
            usersRef,
            where('name', '==', name),
            where('userClass', '==', userClass)
        );

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const userData = snapshot.docs[0].data();
            return {
                photoURL: userData.photoURL,
                customPhotoURL: userData.customPhotoURL
            };
        }

        return {};
    } catch (error) {
        console.error('Error fetching user photo:', error);
        return {};
    }
};

export const getPhotoUrl = (userPhoto: UserPhoto): string | null => {
    // Only show photos that were explicitly uploaded through the site
    // or preserved from Google (copied to customPhotoURL)
    // All other Google photos (default silhouettes, generated initials, etc.) 
    // will return null and show our colored initials instead
    return userPhoto.customPhotoURL || null;
};