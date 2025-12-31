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

    if (!match) {
        const words = normalizedCrush.split(/\s+/);
        if (words.length >= 2) {
            const reversed = [...words].reverse().join(' ');
            match = filteredUsers.find(user =>
                user.name &&
                normalizeName(user.name) === reversed
            );
        }
    }

    return match || null;
}