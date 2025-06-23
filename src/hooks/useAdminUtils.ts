import { useCallback } from 'react';
import type { UserData } from '../types/userTypes';

interface CrusherInfo {
    name: string;
    email: string;
}

interface InactiveUser extends UserData {
    isInactive: boolean;
}

interface GhostUser extends UserData {
    isGhost: boolean;
}

export const useAdminUtils = (allUsers: (UserData | InactiveUser | GhostUser)[]) => {
    const findCrushersForUser = useCallback((targetUser: UserData | InactiveUser | GhostUser): CrusherInfo[] => {
        const crushers: CrusherInfo[] = [];
        const targetName = targetUser.name;
        const targetClass = targetUser.userClass || 'gsb';

        if (!targetName) return crushers;

        allUsers.forEach(u => {
            if (u.uid === targetUser.uid || (u as InactiveUser).isInactive || (u as GhostUser).isGhost) return;

            // Only consider crushes from users in the same class
            const userClass = u.userClass || 'gsb';
            if (userClass !== targetClass) return;

            const userCrushes = u.crushes || [];
            if (userCrushes.includes(targetName)) {
                crushers.push({
                    name: u.name,
                    email: u.email
                });
            }
        });

        return crushers;
    }, [allUsers]);

    return { findCrushersForUser };
};