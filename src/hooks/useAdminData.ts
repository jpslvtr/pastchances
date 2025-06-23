import { useState, useCallback, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { GSB_CLASS_NAMES } from '../data/names';
import { UNDERGRAD_CLASS_NAMES } from '../data/names-undergrad';
import { findUserByName } from '../utils/adminUtils';
import type { UserData, UserClass } from '../types/userTypes';

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

interface ClassAnalyticsData {
    totalUsers: number;
    totalClassSize: number;
    totalMatches: number;
    matchedPairs: string[];
    totalCrushes: number;
    peopleWithCrushes: number;
    avgCrushes: number;
    usersWithCrushes: number;
    usersWithMatches: number;
    participationRate: number;
    classParticipationRate: number;
    orphanedCrushes: string[];
    topCrushReceivers: Array<{ name: string; count: number; crushers: string[] }>;
    topCrushSenders: Array<{ name: string; count: number; crushNames: string[] }>;
    inactiveReceivers: Array<{ name: string; email: string; crushCount: number; reason: string; crushers: CrusherInfo[] }>;
    activeUsersLast24h: number; // Percentage of active users who were active in last 24h
}

export const useAdminData = (user: any, currentClassView: UserClass, refreshKey: number) => {
    const [allUsers, setAllUsers] = useState<(UserData | InactiveUser | GhostUser)[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [currentAnalytics, setCurrentAnalytics] = useState<ClassAnalyticsData | null>(null);
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);

    const normalizeName = useCallback((name: string): string => {
        if (!name || typeof name !== 'string') return '';

        return name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim()
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }, []);

    const calculateRealTime24hActiveUsers = useCallback((activeUsers: UserData[]): number => {
        if (activeUsers.length === 0) return 0;

        const twentyFourHoursAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));
        let recentlyActiveCount = 0;

        activeUsers.forEach(user => {
            if (user.lastLogin) {
                let lastLoginDate;

                if (user.lastLogin.toDate) {
                    lastLoginDate = user.lastLogin.toDate();
                } else if (user.lastLogin.seconds) {
                    lastLoginDate = new Date(user.lastLogin.seconds * 1000);
                } else {
                    lastLoginDate = new Date(user.lastLogin);
                }

                if (lastLoginDate > twentyFourHoursAgo) {
                    recentlyActiveCount++;
                }
            }
        });

        // Percentage of active users (signed-up students) who were active in last 24h
        return Number((recentlyActiveCount / activeUsers.length * 100).toFixed(2));
    }, []);

    const calculateClassAnalytics = useCallback((targetClass: UserClass): ClassAnalyticsData => {
        const realUsers = allUsers.filter(u =>
            !(u as InactiveUser).isInactive && !(u as GhostUser).isGhost
        ) as UserData[];

        // Filter users by class - these are the "active users" (signed up students)
        const classUsers = realUsers.filter(user => (user.userClass || 'gsb') === targetClass);

        // Get class size
        const totalClassSize = targetClass === 'gsb' ? GSB_CLASS_NAMES.length : UNDERGRAD_CLASS_NAMES.length;

        // Basic stats
        const totalUsers = classUsers.length;

        // Calculate matches within class
        const classPairs = new Set<string>();

        classUsers.forEach(user => {
            const matches = user.matches || [];
            if (Array.isArray(matches) && matches.length > 0) {
                matches.forEach(match => {
                    const matchName = match.name || match;
                    const pair = [user.name, matchName].sort().join(' ↔ ');
                    classPairs.add(pair);
                });
            }
        });

        const totalMatches = classPairs.size;
        const matchedPairs = Array.from(classPairs).sort();

        // Calculate crush statistics for class
        let totalCrushes = 0;

        classUsers.forEach(user => {
            const userCrushes = user.crushes || [];
            totalCrushes += userCrushes.length;
        });

        const crushCounts = new Map<string, number>();
        const crushersMap = new Map<string, string[]>();

        classUsers.forEach(user => {
            const userCrushes = user.crushes || [];
            userCrushes.forEach(crushName => {
                const targetUser = findUserByName(crushName, allUsers, targetClass);

                if (targetUser) {
                    const actualName = targetUser.name;
                    if (actualName) {
                        crushCounts.set(actualName, (crushCounts.get(actualName) || 0) + 1);
                        if (!crushersMap.has(actualName)) {
                            crushersMap.set(actualName, []);
                        }
                        crushersMap.get(actualName)!.push(user.name);
                    }
                } else {
                    crushCounts.set(crushName, (crushCounts.get(crushName) || 0) + 1);
                    if (!crushersMap.has(crushName)) {
                        crushersMap.set(crushName, []);
                    }
                    crushersMap.get(crushName)!.push(user.name);
                }
            });
        });

        const peopleWithCrushes = Array.from(crushCounts.keys()).filter(name => crushCounts.get(name)! > 0).length;
        const avgCrushes = totalUsers > 0 ? totalCrushes / totalUsers : 0;

        // User activity stats
        const usersWithCrushes = classUsers.filter(user => user.crushes.length > 0).length;
        const usersWithMatches = classUsers.filter(user => user.matches.length > 0).length;

        // Participation rates
        const participationRate = totalUsers > 0 ? (usersWithCrushes / totalUsers * 100) : 0;
        const classParticipationRate = totalClassSize > 0 ? (usersWithCrushes / totalClassSize * 100) : 0;

        // Find orphaned crushes
        const orphanedCrushes: string[] = [];
        const allCrushNames = new Set<string>();

        classUsers.forEach(user => {
            const userCrushes = user.crushes || [];
            userCrushes.forEach(crushName => {
                allCrushNames.add(crushName);
            });
        });

        allCrushNames.forEach(crushName => {
            const match = findUserByName(crushName, allUsers, targetClass);
            if (!match) {
                orphanedCrushes.push(crushName);
            }
        });

        // Top crush receivers (limit for performance)
        const topCrushReceivers = Array.from(crushCounts.entries())
            .map(([name, count]) => ({
                name,
                count,
                crushers: crushersMap.get(name) || []
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 25);

        // Top crush senders (limit for performance)
        const topCrushSenders = classUsers
            .map(user => ({
                name: user.name,
                count: user.crushes.length,
                crushNames: user.crushes
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 25);

        // Inactive receivers
        const inactiveReceivers: Array<{ name: string; email: string; crushCount: number; reason: string; crushers: CrusherInfo[] }> = [];

        classUsers.forEach(user => {
            if (user.crushCount > 0) {
                const hasSubmittedCrushes = !!(user.crushes && user.crushes.length > 0);

                if (!hasSubmittedCrushes) {
                    const crushers: CrusherInfo[] = [];
                    const targetName = user.name;
                    const targetClass = user.userClass || 'gsb';

                    if (targetName) {
                        allUsers.forEach(u => {
                            if (u.uid === user.uid || (u as InactiveUser).isInactive || (u as GhostUser).isGhost) return;

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
                    }

                    inactiveReceivers.push({
                        name: user.name || 'Unknown',
                        email: user.email,
                        crushCount: user.crushCount,
                        reason: 'No crushes submitted',
                        crushers
                    });
                }
            }
        });

        inactiveReceivers.sort((a, b) => b.crushCount - a.crushCount);

        return {
            totalUsers,
            totalClassSize,
            totalMatches,
            matchedPairs,
            totalCrushes,
            peopleWithCrushes,
            avgCrushes: Number(avgCrushes.toFixed(2)),
            usersWithCrushes,
            usersWithMatches,
            participationRate: Number(participationRate.toFixed(2)),
            classParticipationRate: Number(classParticipationRate.toFixed(2)),
            orphanedCrushes,
            topCrushReceivers,
            topCrushSenders,
            inactiveReceivers,
            activeUsersLast24h: calculateRealTime24hActiveUsers(classUsers)
        };
    }, [allUsers, calculateRealTime24hActiveUsers]);

    const loadAllUsers = useCallback(async () => {
        if (user?.email !== 'jpark22@stanford.edu') {
            return;
        }

        setLoadingUsers(true);
        try {
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const realUsers: UserData[] = [];

            usersSnapshot.forEach(doc => {
                const data = doc.data() as UserData;
                realUsers.push({
                    ...data,
                    uid: doc.id,
                    userClass: data.userClass || 'gsb'
                });
            });

            // Create inactive and ghost users only for the current class
            const realUserNames = new Set(realUsers.map(u => u.name).filter(Boolean));
            const inactiveUsers: InactiveUser[] = [];
            const ghostUsers: GhostUser[] = [];

            // Only process the current class roster
            const currentClassNames = currentClassView === 'gsb' ? GSB_CLASS_NAMES : UNDERGRAD_CLASS_NAMES;

            currentClassNames.forEach(className => {
                if (realUserNames.has(className)) {
                    return;
                }

                let crushCount = 0;
                realUsers.forEach(user => {
                    if ((user.userClass || 'gsb') === currentClassView) {
                        const userCrushes = user.crushes || [];
                        if (userCrushes.includes(className)) {
                            crushCount++;
                        }
                    }
                });

                const derivedEmail = `${className.toLowerCase().replace(/\s+/g, '.')}@stanford.edu`;

                if (crushCount > 0) {
                    const inactiveId = `inactive-${currentClassView}-${normalizeName(className).replace(/\s+/g, '-')}`;
                    inactiveUsers.push({
                        uid: inactiveId,
                        email: derivedEmail,
                        name: className,
                        photoURL: '/files/default-profile.png',
                        crushes: [],
                        lockedCrushes: [],
                        matches: [],
                        crushCount: crushCount,
                        userClass: currentClassView,
                        isInactive: true,
                        createdAt: null,
                        updatedAt: null,
                        lastLogin: null
                    });
                } else {
                    const ghostId = `ghost-${currentClassView}-${normalizeName(className).replace(/\s+/g, '-')}`;
                    ghostUsers.push({
                        uid: ghostId,
                        email: derivedEmail,
                        name: className,
                        photoURL: '/files/default-profile.png',
                        crushes: [],
                        lockedCrushes: [],
                        matches: [],
                        crushCount: 0,
                        userClass: currentClassView,
                        isGhost: true,
                        createdAt: null,
                        updatedAt: null,
                        lastLogin: null
                    });
                }
            });

            // Filter all users to only include the current class
            const currentClassRealUsers = realUsers.filter(user => (user.userClass || 'gsb') === currentClassView);
            const allUsersArray = [...currentClassRealUsers, ...inactiveUsers, ...ghostUsers];

            // Sort alphabetically within each type
            allUsersArray.sort((a, b) => {
                const aIsInactive = (a as InactiveUser).isInactive || false;
                const bIsInactive = (b as InactiveUser).isInactive || false;
                const aIsGhost = (a as GhostUser).isGhost || false;
                const bIsGhost = (b as GhostUser).isGhost || false;

                // Active users first, then inactive, then ghost
                if (!aIsInactive && !aIsGhost && (bIsInactive || bIsGhost)) return -1;
                if ((aIsInactive || aIsGhost) && !bIsInactive && !bIsGhost) return 1;

                if (aIsInactive && !bIsInactive && bIsGhost) return -1;
                if (!aIsInactive && aIsGhost && bIsInactive) return 1;

                // Then alphabetically
                const nameA = a.name || a.email || '';
                const nameB = b.name || b.email || '';
                return nameA.localeCompare(nameB);
            });

            setAllUsers(allUsersArray);

        } catch (error: any) {
            console.error('Error loading all users:', error);
        } finally {
            setLoadingUsers(false);
        }
    }, [normalizeName, user?.email, currentClassView]);

    useEffect(() => {
        if (user?.email === 'jpark22@stanford.edu') {
            loadAllUsers();
        }
    }, [user, loadAllUsers]);

    // Calculate analytics for current class only
    useEffect(() => {
        if (allUsers.length > 0 && user?.email === 'jpark22@stanford.edu') {
            setLoadingAnalytics(true);

            const timeoutId = setTimeout(() => {
                try {
                    const analyticsData = calculateClassAnalytics(currentClassView);
                    setCurrentAnalytics(analyticsData);
                } finally {
                    setLoadingAnalytics(false);
                }
            }, 300);

            return () => clearTimeout(timeoutId);
        }
    }, [allUsers, calculateClassAnalytics, refreshKey, user?.email, currentClassView]);

    return {
        allUsers,
        loadingUsers,
        currentAnalytics,
        loadingAnalytics,
        loadAllUsers
    };
};