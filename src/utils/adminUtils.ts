import type { UserData, UserClass } from '../types/userTypes';

interface InactiveUser extends UserData {
    isInactive: boolean;
}

interface GhostUser extends UserData {
    isGhost: boolean;
}

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