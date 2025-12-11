import type { User } from 'firebase/auth';
import type { UserData, UserClass } from '../types/userTypes';

const ADMIN_EMAILS = [
    'jpark22@stanford.edu',
    'jamespark@alumni.stanford.edu',
    'jamespark@alumni.gsb.stanford.edu'
];

export const isAdminUser = (user: User | null, userData: UserData | null): boolean => {
    if (!user) return false;

    const currentEmail = user.email?.toLowerCase() || '';

    if (ADMIN_EMAILS.includes(currentEmail)) {
        return true;
    }

    if (userData) {
        const dbEmail = userData.email?.toLowerCase() || '';
        const dbEmailAlumni = userData.emailAlumni?.toLowerCase() || '';
        const dbEmailAlumniGSB = userData.emailAlumniGSB?.toLowerCase() || '';

        return ADMIN_EMAILS.includes(dbEmail) ||
            ADMIN_EMAILS.includes(dbEmailAlumni) ||
            ADMIN_EMAILS.includes(dbEmailAlumniGSB);
    }

    return false;
};

export const isAdminEmail = (email: string | undefined | null): boolean => {
    if (!email) return false;

    const normalized = email.toLowerCase();
    return ADMIN_EMAILS.includes(normalized);
};

interface InactiveUser extends UserData {
    isInactive: boolean;
}

interface GhostUser extends UserData {
    isGhost: boolean;
}

function normalizeName(name: string): string {
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

export function findUserByName(
    crushName: string,
    allUsers: (UserData | InactiveUser | GhostUser)[],
    userClass?: UserClass
): UserData | InactiveUser | GhostUser | null {
    if (!crushName || !crushName.trim()) return null;

    const normalizedCrush = normalizeName(crushName);

    const filteredUsers = userClass
        ? allUsers.filter(user => (user.userClass || 'gsb') === userClass)
        : allUsers;

    let match = filteredUsers.find(user =>
        user.name &&
        normalizeName(user.name) === normalizedCrush
    );

    if (match) return match;

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

export const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

export const calculateStats = (users: UserData[]) => {
    const totalUsers = users.length;
    const usersWithCrushes = users.filter(u => u.crushes && u.crushes.length > 0).length;
    const usersWithMatches = users.filter(u => u.matches && u.matches.length > 0).length;
    const totalCrushes = users.reduce((sum, u) => sum + (u.crushes?.length || 0), 0);
    const totalMatches = users.reduce((sum, u) => sum + (u.matches?.length || 0), 0);

    return {
        totalUsers,
        usersWithCrushes,
        usersWithMatches,
        totalCrushes,
        totalMatches,
        avgCrushesPerUser: totalUsers > 0 ? (totalCrushes / totalUsers).toFixed(2) : '0.00',
        avgMatchesPerUser: totalUsers > 0 ? (totalMatches / totalUsers).toFixed(2) : '0.00'
    };
};