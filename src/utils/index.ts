import type { UserData, UserClass, InactiveUser, GhostUser } from '../types';

// Helper function to normalize names for case-insensitive comparison
export function normalizeName(name: string): string {
    if (!name || typeof name !== 'string') return '';

    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Enhanced function to find the best matching user for a crush name
export function findUserByName(
    crushName: string,
    allUsers: (UserData | InactiveUser | GhostUser)[],
    userClass?: UserClass
): UserData | InactiveUser | GhostUser | null {
    if (!crushName || !crushName.trim()) return null;

    const normalizedCrush = normalizeName(crushName);

    // Filter by class if specified
    const filteredUsers = userClass
        ? allUsers.filter(user => (user.userClass || 'gsb') === userClass)
        : allUsers;

    // Try exact match on name field
    let match = filteredUsers.find(user =>
        user.name &&
        normalizeName(user.name) === normalizedCrush
    );

    if (match) return match;

    // Try partial match (first and last name only)
    const crushParts = normalizedCrush.split(' ');
    if (crushParts.length >= 2) {
        const crushFirstLast = `${crushParts[0]} ${crushParts[crushParts.length - 1]}`;

        match = filteredUsers.find(user => {
            if (user.name) {
                const nameParts = normalizeName(user.name).split(' ');
                if (nameParts.length >= 2) {
                    const nameFirstLast = `${nameParts[0]} ${nameParts[nameParts.length - 1]}`;
                    return nameFirstLast === crushFirstLast;
                }
            }
            return false;
        });
    }

    return match || null;
}

// Helper function to get user's identity name
export function getUserIdentityName(user: UserData | InactiveUser | GhostUser): string {
    return user.name || '';
}

// Fast name matching function optimized for first/last name searches
export const matchesSearchTerm = (searchableText: string, searchTerm: string): { matches: boolean; score: number } => {
    if (!searchTerm.trim()) return { matches: true, score: 0 };

    const normalizeText = (text: string) => text.toLowerCase().trim();
    const normalizedText = normalizeText(searchableText);
    const normalizedSearch = normalizeText(searchTerm);

    // Exact substring match (highest priority)
    if (normalizedText.includes(normalizedSearch)) {
        return { matches: true, score: 100 };
    }

    const textParts = normalizedText.split(' ').filter(Boolean);
    const searchParts = normalizedSearch.split(' ').filter(Boolean);

    // First + Last name matching (most common use case)
    if (searchParts.length >= 2) {
        const searchFirst = searchParts[0];
        const searchLast = searchParts[searchParts.length - 1];

        if (textParts.length >= 2) {
            const textFirst = textParts[0];
            const textLast = textParts[textParts.length - 1];

            // Exact first + last match
            if (textFirst === searchFirst && textLast === searchLast) {
                return { matches: true, score: 95 };
            }

            // Partial first + exact last
            if (textFirst.startsWith(searchFirst) && textLast === searchLast) {
                return { matches: true, score: 90 };
            }

            // Exact first + partial last
            if (textFirst === searchFirst && textLast.startsWith(searchLast)) {
                return { matches: true, score: 85 };
            }
        }
    }

    // Single term matching
    if (searchParts.length === 1) {
        const searchTerm = searchParts[0];

        // Check if any text part starts with search term
        if (textParts.some(part => part.startsWith(searchTerm))) {
            return { matches: true, score: 80 };
        }
    }

    // Multi-word progressive matching
    let textIndex = 0;
    let matchedParts = 0;

    for (const searchPart of searchParts) {
        for (let i = textIndex; i < textParts.length; i++) {
            if (textParts[i].startsWith(searchPart)) {
                matchedParts++;
                textIndex = i + 1;
                break;
            }
        }
    }

    if (matchedParts === searchParts.length) {
        return { matches: true, score: 75 };
    }

    return { matches: false, score: 0 };
};

// Helper function to format timestamps
export const formatTimestamp = (timestamp: any, relative: boolean = true): string => {
    if (!timestamp) return 'Unknown';

    let date: Date;

    try {
        // Handle Firestore Timestamp with seconds property
        if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
            date = new Date(timestamp.seconds * 1000);
        }
        // Handle Firestore Timestamp with toDate method
        else if (timestamp && typeof timestamp.toDate === 'function') {
            date = timestamp.toDate();
        }
        // Handle regular Date object
        else if (timestamp instanceof Date) {
            date = timestamp;
        }
        // Handle string or number timestamps
        else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
            date = new Date(timestamp);
        }
        // Handle the _seconds format from debug output
        else if (timestamp && timestamp._seconds) {
            date = new Date(timestamp._seconds * 1000);
        }
        else {
            return 'Unknown format';
        }

        // Validate the date
        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }

        if (!relative) {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
            });
        }

        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) {
            return 'Just now';
        } else if (diffInSeconds < 3600) {
            const minutes = Math.floor(diffInSeconds / 60);
            return `${minutes}m ago`;
        } else if (diffInSeconds < 86400) {
            const hours = Math.floor(diffInSeconds / 3600);
            return `${hours}h ago`;
        } else if (diffInSeconds < 604800) {
            const days = Math.floor(diffInSeconds / 86400);
            return `${days}d ago`;
        } else {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            });
        }
    } catch (error) {
        console.error('Error formatting timestamp:', error);
        return 'Format Error';
    }
};

// Helper to get class display name
export const getClassDisplayName = (userClass: UserClass): string => {
    return userClass === 'gsb' ? 'GSB MBA' : 'Undergraduate';
};

// Helper to get class names array
export const getClassNames = async (userClass: UserClass): Promise<string[]> => {
    if (userClass === 'gsb') {
        const { GSB_CLASS_NAMES } = await import('../data/names');
        return GSB_CLASS_NAMES;
    } else {
        const { UNDERGRAD_CLASS_NAMES } = await import('../data/names-undergrad');
        return UNDERGRAD_CLASS_NAMES;
    }
};