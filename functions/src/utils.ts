import { UserWithId } from './types';

// Helper function to normalize names for case-insensitive comparison
export function normalizeName(name: string): string {
    if (!name || typeof name !== 'string') return '';

    return name
        .normalize('NFD')  // Decompose accented characters
        .replace(/[\u0300-\u036f]/g, '')  // Remove accent marks
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, ' ')  // Replace non-alphanumeric with spaces
        .replace(/\s+/g, ' ')  // Normalize spaces
        .trim();
}

// Enhanced function to find the best matching user for a crush name
export function findUserByName(crushName: string, allUsers: UserWithId[]): UserWithId | null {
    if (!crushName || !crushName.trim()) return null;

    const normalizedCrush = normalizeName(crushName);

    // First try exact match on name field
    let match = allUsers.find(user =>
        user.name &&
        normalizeName(user.name) === normalizedCrush
    );

    if (match) return match;

    // Try exact match on legacy verifiedName field (for migration)
    match = allUsers.find(user =>
        user.verifiedName &&
        normalizeName(user.verifiedName) === normalizedCrush
    );

    if (match) return match;

    // Try exact match on legacy displayName field (for migration)
    match = allUsers.find(user =>
        user.displayName &&
        normalizeName(user.displayName) === normalizedCrush
    );

    if (match) return match;

    // Try partial match (first and last name only) for cases with middle names
    const crushParts = normalizedCrush.split(' ');
    if (crushParts.length >= 2) {
        const crushFirstLast = `${crushParts[0]} ${crushParts[crushParts.length - 1]}`;

        // Try partial match with name field
        match = allUsers.find(user => {
            const userIdentityName = user.name || user.verifiedName || user.displayName;
            if (userIdentityName) {
                const nameParts = normalizeName(userIdentityName).split(' ');
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

// Helper function to get user's identity name (with migration support)
export function getUserIdentityName(user: UserWithId): string {
    return user.name || user.verifiedName || user.displayName || '';
}