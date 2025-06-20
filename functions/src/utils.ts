import { UserWithId } from './types';

// Enhanced helper function to normalize names for case-insensitive comparison
export function normalizeName(name: string): string {
    if (!name || typeof name !== 'string') return '';
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Enhanced function to find the best matching user for a crush name
export function findUserByName(crushName: string, allUsers: UserWithId[]): UserWithId | null {
    if (!crushName || !crushName.trim()) return null;

    const normalizedCrush = normalizeName(crushName);

    // First try exact match on verifiedName
    let match = allUsers.find(user =>
        user.verifiedName &&
        normalizeName(user.verifiedName) === normalizedCrush
    );

    if (match) return match;

    // Try exact match on displayName as fallback
    match = allUsers.find(user =>
        user.displayName &&
        normalizeName(user.displayName) === normalizedCrush
    );

    if (match) return match;

    // Try partial match (first and last name only) for cases with middle names
    const crushParts = normalizedCrush.split(' ');
    if (crushParts.length >= 2) {
        const crushFirstLast = `${crushParts[0]} ${crushParts[crushParts.length - 1]}`;

        // Try partial match with verifiedName
        match = allUsers.find(user => {
            if (user.verifiedName) {
                const nameParts = normalizeName(user.verifiedName).split(' ');
                if (nameParts.length >= 2) {
                    const nameFirstLast = `${nameParts[0]} ${nameParts[nameParts.length - 1]}`;
                    return nameFirstLast === crushFirstLast;
                }
            }
            return false;
        });

        if (match) return match;

        // Try partial match with displayName
        match = allUsers.find(user => {
            if (user.displayName) {
                const nameParts = normalizeName(user.displayName).split(' ');
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