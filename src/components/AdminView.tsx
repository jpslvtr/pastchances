import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { GSB_CLASS_NAMES } from '../data/names';
import AdminAnalytics from './admin/AdminAnalytics';
import AdminUsers from './admin/AdminUsers';

interface MatchInfo {
    name: string;
    email: string;
}

interface UserData {
    uid: string;
    email: string;
    name: string;  // Single name field
    photoURL: string;
    crushes: string[];
    lockedCrushes: string[];
    matches: MatchInfo[];
    crushCount: number;
    createdAt: any;
    updatedAt: any;
    lastLogin: any;
}

interface CrusherInfo {
    name: string;
    email: string;
}

interface InactiveUser {
    uid: string;
    email: string;
    name: string;
    photoURL: string;
    crushes: string[];
    lockedCrushes: string[];
    matches: MatchInfo[];
    crushCount: number;
    isInactive: boolean;
    createdAt: any;
    updatedAt: any;
    lastLogin: any;
}

interface FirebaseAnalyticsData {
    totalUsers: number;
    totalTakenNames: number;
    totalMatches: number;
    matchedPairs: string[];
    totalCrushes: number;
    peopleWithCrushes: number;
    avgCrushes: number;
    activeUsersLast24h: number;
    createdAt: any;
}

interface AnalyticsData {
    totalUsers: number;
    totalTakenNames: number;
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
    activeUsersLast24h: number;
}

type UserFilter = 'all' | 'active' | 'inactive';
type ViewMode = 'analytics' | 'users';

interface AdminViewProps {
    user: any;
}

const AdminView: React.FC<AdminViewProps> = ({ user }) => {
    const [allUsers, setAllUsers] = useState<(UserData | InactiveUser)[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [adminSearchTerm, setAdminSearchTerm] = useState('');
    const [viewingUserId, setViewingUserId] = useState<string | null>(null);
    const [userFilter, setUserFilter] = useState<UserFilter>('all');
    const [viewMode, setViewMode] = useState<ViewMode>('analytics');
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

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

    const findUserByName = useCallback((crushName: string, users: (UserData | InactiveUser)[]): UserData | InactiveUser | null => {
        if (!crushName || !crushName.trim()) return null;

        const normalizedCrush = normalizeName(crushName);

        // Try exact match on name field
        let match = users.find(user =>
            user.name &&
            normalizeName(user.name) === normalizedCrush
        );

        if (match) return match;

        // Try partial match (first and last name only)
        const crushParts = normalizedCrush.split(' ');
        if (crushParts.length >= 2) {
            const crushFirstLast = `${crushParts[0]} ${crushParts[crushParts.length - 1]}`;

            match = users.find(user => {
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
    }, [normalizeName]);

    const findCrushersForUser = useCallback((targetUser: UserData | InactiveUser): CrusherInfo[] => {
        const crushers: CrusherInfo[] = [];
        const targetName = targetUser.name;

        if (!targetName) return crushers;

        allUsers.forEach(u => {
            if (u.uid === targetUser.uid || (u as InactiveUser).isInactive) return;

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

    // Set up real-time listener for analytics
    useEffect(() => {
        const analyticsQuery = query(
            collection(db, 'analytics'),
            orderBy('createdAt', 'desc'),
            limit(1)
        );

        const unsubscribe = onSnapshot(analyticsQuery, (snapshot) => {
            if (!snapshot.empty) {
                const latestAnalytics = snapshot.docs[0].data() as FirebaseAnalyticsData;
                console.log('Live analytics updated:', latestAnalytics);
            }
        }, (error) => {
            console.error('Error listening to analytics:', error);
        });

        return () => unsubscribe();
    }, []);

    const calculateRealTime24hActiveUsers = useCallback((): number => {
        const realUsers = allUsers.filter(u => !(u as InactiveUser).isInactive) as UserData[];

        if (realUsers.length === 0) return 0;

        const twentyFourHoursAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));
        let activeUsersCount = 0;

        realUsers.forEach(user => {
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
                    activeUsersCount++;
                }
            }
        });

        return Number((activeUsersCount / realUsers.length * 100).toFixed(2));
    }, [allUsers]);

    const calculateAnalytics = useCallback((): AnalyticsData => {
        const realUsers = allUsers.filter(u => !(u as InactiveUser).isInactive) as UserData[];

        // Basic stats
        const totalUsers = realUsers.length;
        const totalTakenNames = realUsers.filter(u => u.name && u.name.trim()).length;

        // Calculate matches
        const seenPairs = new Set<string>();
        realUsers.forEach(user => {
            const matches = user.matches || [];
            if (Array.isArray(matches) && matches.length > 0) {
                matches.forEach(match => {
                    const matchName = match.name || match;
                    const pair = [user.name, matchName].sort().join(' ↔ ');
                    seenPairs.add(pair);
                });
            }
        });

        const totalMatches = seenPairs.size;
        const matchedPairs = Array.from(seenPairs).sort();

        // Calculate crush statistics
        const crushCounts = new Map<string, number>();
        const crushersMap = new Map<string, string[]>();
        let totalCrushes = 0;

        realUsers.forEach(user => {
            const userCrushes = user.crushes || [];
            totalCrushes += userCrushes.length;

            userCrushes.forEach(crushName => {
                const targetUser = findUserByName(crushName, allUsers);

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
        const usersWithCrushes = realUsers.filter(user => user.crushes.length > 0).length;
        const usersWithMatches = realUsers.filter(user => user.matches.length > 0).length;

        // Participation rates
        const participationRate = totalUsers > 0 ? (usersWithCrushes / totalUsers * 100) : 0;
        const classParticipationRate = GSB_CLASS_NAMES.length > 0 ? (usersWithCrushes / GSB_CLASS_NAMES.length * 100) : 0;

        // Find orphaned crushes
        const orphanedCrushes: string[] = [];
        const allCrushNames = new Set<string>();

        realUsers.forEach(user => {
            const userCrushes = user.crushes || [];
            userCrushes.forEach(crushName => {
                allCrushNames.add(crushName);
            });
        });

        allCrushNames.forEach(crushName => {
            const matchedUser = findUserByName(crushName, allUsers);
            if (!matchedUser) {
                orphanedCrushes.push(crushName);
            }
        });

        // Top crush receivers
        const topCrushReceivers = Array.from(crushCounts.entries())
            .map(([name, count]) => ({
                name,
                count,
                crushers: crushersMap.get(name) || []
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);

        // Top crush senders
        const topCrushSenders = realUsers
            .map(user => ({
                name: user.name,
                count: user.crushes.length,
                crushNames: user.crushes
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);

        // Inactive receivers (people with crushes who haven't submitted)
        const inactiveReceivers: Array<{ name: string; email: string; crushCount: number; reason: string; crushers: CrusherInfo[] }> = [];

        realUsers.forEach(user => {
            if (user.crushCount > 0) {
                const hasName = !!(user.name && user.name.trim());
                const hasSubmittedCrushes = !!(user.crushes && user.crushes.length > 0);

                if (!hasName || !hasSubmittedCrushes) {
                    const crushers = findCrushersForUser(user);

                    let reason = '';
                    if (!hasName && !hasSubmittedCrushes) {
                        reason = 'No name set and no crushes submitted';
                    } else if (!hasName) {
                        reason = 'No name set';
                    } else if (!hasSubmittedCrushes) {
                        reason = 'No crushes submitted';
                    }

                    inactiveReceivers.push({
                        name: user.name || 'Unknown',
                        email: user.email,
                        crushCount: user.crushCount,
                        reason,
                        crushers
                    });
                }
            }
        });

        inactiveReceivers.sort((a, b) => b.crushCount - a.crushCount);

        return {
            totalUsers,
            totalTakenNames,
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
            activeUsersLast24h: calculateRealTime24hActiveUsers()
        };
    }, [allUsers, findUserByName, findCrushersForUser, calculateRealTime24hActiveUsers]);

    const loadAllUsers = useCallback(async () => {
        setLoadingUsers(true);
        try {
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const realUsers: UserData[] = [];

            usersSnapshot.forEach(doc => {
                const data = doc.data() as UserData;
                realUsers.push({
                    ...data,
                    uid: doc.id
                });
            });

            // Create inactive users for class members who haven't signed up but are receiving crushes
            const allCrushNames = new Set<string>();
            realUsers.forEach(user => {
                const userCrushes = user.crushes || [];
                userCrushes.forEach(crushName => {
                    allCrushNames.add(crushName);
                });
            });

            const realUserNames = new Set(realUsers.map(u => u.name).filter(Boolean));
            const inactiveUsers: InactiveUser[] = [];

            // Find class members who haven't signed up but are being crushed on
            GSB_CLASS_NAMES.forEach(className => {
                if (realUserNames.has(className)) {
                    return; // This person has signed up
                }

                // Check if anyone is crushing on this person
                let crushCount = 0;
                realUsers.forEach(user => {
                    const userCrushes = user.crushes || [];
                    if (userCrushes.includes(className)) {
                        crushCount++;
                    }
                });

                if (crushCount > 0) {
                    // This person is being crushed on but hasn't signed up
                    const inactiveId = `inactive-${normalizeName(className).replace(/\s+/g, '-')}`;
                    const derivedEmail = `${className.toLowerCase().replace(/\s+/g, '.')}@stanford.edu`;

                    inactiveUsers.push({
                        uid: inactiveId,
                        email: derivedEmail,
                        name: className,
                        photoURL: '/files/default-profile.png',
                        crushes: [],
                        lockedCrushes: [],
                        matches: [],
                        crushCount: crushCount,
                        isInactive: true,
                        createdAt: null,
                        updatedAt: null,
                        lastLogin: null
                    });
                }
            });

            const allUsersArray = [...realUsers, ...inactiveUsers];

            // Sort: active users first, then inactive users, then alphabetically
            allUsersArray.sort((a, b) => {
                const aIsInactive = (a as InactiveUser).isInactive || false;
                const bIsInactive = (b as InactiveUser).isInactive || false;

                if (!aIsInactive && bIsInactive) return -1;
                if (aIsInactive && !bIsInactive) return 1;

                const nameA = a.name || a.email || '';
                const nameB = b.name || b.email || '';
                return nameA.localeCompare(nameB);
            });

            setAllUsers(allUsersArray);

        } catch (error) {
            console.error('Error loading all users:', error);
        } finally {
            setLoadingUsers(false);
        }
    }, [normalizeName]);

    useEffect(() => {
        if (user) {
            loadAllUsers();
        }
    }, [user, loadAllUsers]);

    useEffect(() => {
        if (allUsers.length > 0) {
            setAnalytics(calculateAnalytics());
        }
    }, [allUsers, calculateAnalytics]);

    const userStats = useMemo(() => {
        const realUsers = allUsers.filter(u => !(u as InactiveUser).isInactive);
        const inactiveUsers = allUsers.filter(u => (u as InactiveUser).isInactive);

        return {
            realUsers: realUsers.length,
            inactiveUsers: inactiveUsers.length,
            total: allUsers.length
        };
    }, [allUsers]);

    const handleViewUser = (userId: string) => {
        setViewingUserId(viewingUserId === userId ? null : userId);
    };

    const filteredUsers = useMemo(() => {
        let users = allUsers;

        switch (userFilter) {
            case 'active':
                users = users.filter(u => !(u as InactiveUser).isInactive);
                break;
            case 'inactive':
                users = users.filter(u => (u as InactiveUser).isInactive);
                break;
            case 'all':
            default:
                break;
        }

        if (!adminSearchTerm.trim()) return users;

        const searchLower = adminSearchTerm.toLowerCase();
        return users.filter(u => {
            const name = (u.name || '').toLowerCase();
            const email = (u.email || '').toLowerCase();

            return name.includes(searchLower) || email.includes(searchLower);
        });
    }, [allUsers, adminSearchTerm, userFilter]);

    return (
        <div className="admin-section">
            <h3>Admin Dashboard</h3>

            <div className="admin-definitions">
                <p><strong>Active Users:</strong> Students who have signed up, verified their Stanford email, and have their name set. They can send crushes and receive matches.</p>
                <p><strong>Inactive Users:</strong> Students from the class roster who haven't signed up yet but are receiving crushes from active users. They appear as potential matches but can't send crushes or see matches until they sign up.</p>
                <p><strong>Inactive Receivers:</strong> Active users who are receiving crushes but haven't engaged properly - either they haven't set their name or haven't sent any crushes themselves. These users need follow-up.</p>
            </div>

            <div className="admin-nav">
                <button
                    onClick={() => setViewMode('analytics')}
                    className={`admin-nav-btn ${viewMode === 'analytics' ? 'active' : ''}`}
                >
                    Analytics
                </button>
                <button
                    onClick={() => setViewMode('users')}
                    className={`admin-nav-btn ${viewMode === 'users' ? 'active' : ''}`}
                >
                    Users ({userStats.total})
                </button>
            </div>

            <div className="admin-content">
                {viewMode === 'analytics' && (
                    <AdminAnalytics analytics={analytics} />
                )}
                {viewMode === 'users' && (
                    <AdminUsers
                        allUsers={filteredUsers}
                        loadingUsers={loadingUsers}
                        adminSearchTerm={adminSearchTerm}
                        setAdminSearchTerm={setAdminSearchTerm}
                        userFilter={userFilter}
                        setUserFilter={setUserFilter}
                        viewingUserId={viewingUserId}
                        handleViewUser={handleViewUser}
                        findCrushersForUser={findCrushersForUser}
                        userStats={userStats}
                    />
                )}
            </div>
        </div>
    );
};

export default AdminView;