import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { GSB_CLASS_NAMES } from '../data/names';
import { UNDERGRAD_CLASS_NAMES } from '../data/names-undergrad';
import AdminAnalytics from './admin/AdminAnalytics';
import AdminUsers from './admin/AdminUsers';
import type { UserData, MatchInfo, UserClass } from '../types/userTypes';

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
    userClass: UserClass;
    isInactive: boolean;
    createdAt: any;
    updatedAt: any;
    lastLogin: any;
}

interface GhostUser {
    uid: string;
    email: string;
    name: string;
    photoURL: string;
    crushes: string[];
    lockedCrushes: string[];
    matches: MatchInfo[];
    crushCount: number;
    userClass: UserClass;
    isGhost: boolean;
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
    activeUsersLast24h: number;
}

type UserFilter = 'all' | 'active' | 'inactive' | 'ghost';
type ViewMode = 'analytics' | 'users';
type ClassView = 'gsb' | 'undergrad';

interface AdminViewProps {
    user: any;
}

const AdminView: React.FC<AdminViewProps> = ({ user }) => {
    // Server-side admin check with error handling
    const [adminAccessDenied, setAdminAccessDenied] = useState(false);
    const [allUsers, setAllUsers] = useState<(UserData | InactiveUser | GhostUser)[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [adminSearchTerm, setAdminSearchTerm] = useState('');
    const [viewingUserId, setViewingUserId] = useState<string | null>(null);
    const [userFilter, setUserFilter] = useState<UserFilter>('all');
    const [viewMode, setViewMode] = useState<ViewMode>('analytics');
    const [classView, setClassView] = useState<ClassView>('gsb');
    const [gsbAnalytics, setGsbAnalytics] = useState<ClassAnalyticsData | null>(null);
    const [undergradAnalytics, setUndergradAnalytics] = useState<ClassAnalyticsData | null>(null);
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    // Strict admin access control
    useEffect(() => {
        if (user?.email !== 'jpark22@stanford.edu') {
            setAdminAccessDenied(true);
            return;
        }
        setAdminAccessDenied(false);
    }, [user?.email]);

    // Early return for non-admin users
    if (adminAccessDenied) {
        return (
            <div className="admin-access-denied">
                <div className="access-denied-card">
                    <h2>Access Denied</h2>
                    <p>You do not have permission to view this page.</p>
                    <p>Admin access is restricted to authorized personnel only.</p>
                </div>
            </div>
        );
    }

    // Only proceed with admin functionality if user is confirmed admin
    if (user?.email !== 'jpark22@stanford.edu') {
        return (
            <div className="admin-loading">
                Verifying admin access...
            </div>
        );
    }

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

    const findUserByName = useCallback((crushName: string, users: (UserData | InactiveUser | GhostUser)[], userClass?: UserClass): UserData | InactiveUser | GhostUser | null => {
        if (!crushName || !crushName.trim()) return null;

        const normalizedCrush = normalizeName(crushName);

        // Filter by class if specified
        const filteredUsers = userClass
            ? users.filter(user => (user.userClass || 'gsb') === userClass)
            : users;

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
    }, [normalizeName]);

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

    // Set up real-time listener for analytics with error handling and admin check
    useEffect(() => {
        if (user?.email !== 'jpark22@stanford.edu') return;

        const analyticsQuery = query(
            collection(db, 'analytics'),
            orderBy('createdAt', 'desc'),
            limit(1)
        );

        const unsubscribe = onSnapshot(analyticsQuery, (snapshot) => {
            if (!snapshot.empty) {
                const latestAnalytics = snapshot.docs[0].data() as FirebaseAnalyticsData;
                console.log('Live analytics updated:', latestAnalytics);
                // Trigger recalculation when new analytics arrive
                setRefreshKey(prev => prev + 1);
            }
        }, (error) => {
            console.error('Error listening to analytics:', error);
            // If we get a permission error, user is not admin
            if (error.code === 'permission-denied') {
                setAdminAccessDenied(true);
            }
        });

        return () => unsubscribe();
    }, [user?.email]);

    const calculateRealTime24hActiveUsers = useCallback((classUsers: UserData[]): number => {
        if (classUsers.length === 0) return 0;

        const twentyFourHoursAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));
        let activeUsersCount = 0;

        classUsers.forEach(user => {
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

        return Number((activeUsersCount / classUsers.length * 100).toFixed(2));
    }, []);

    const calculateClassAnalytics = useCallback((targetClass: UserClass): ClassAnalyticsData => {
        const realUsers = allUsers.filter(u =>
            !(u as InactiveUser).isInactive && !(u as GhostUser).isGhost
        ) as UserData[];

        // Filter users by class
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
                    const crushers = findCrushersForUser(user);

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
    }, [allUsers, findUserByName, findCrushersForUser, calculateRealTime24hActiveUsers]);

    const loadAllUsers = useCallback(async () => {
        if (user?.email !== 'jpark22@stanford.edu') {
            setAdminAccessDenied(true);
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

            // Create inactive and ghost users from both class rosters
            const allCrushNames = new Set<string>();
            realUsers.forEach(user => {
                const userCrushes = user.crushes || [];
                userCrushes.forEach(crushName => {
                    allCrushNames.add(crushName);
                });
            });

            const realUserNames = new Set(realUsers.map(u => u.name).filter(Boolean));
            const inactiveUsers: InactiveUser[] = [];
            const ghostUsers: GhostUser[] = [];

            // Process GSB class members
            GSB_CLASS_NAMES.forEach(className => {
                if (realUserNames.has(className)) {
                    return;
                }

                let crushCount = 0;
                realUsers.forEach(user => {
                    if ((user.userClass || 'gsb') === 'gsb') {
                        const userCrushes = user.crushes || [];
                        if (userCrushes.includes(className)) {
                            crushCount++;
                        }
                    }
                });

                const derivedEmail = `${className.toLowerCase().replace(/\s+/g, '.')}@stanford.edu`;

                if (crushCount > 0) {
                    const inactiveId = `inactive-gsb-${normalizeName(className).replace(/\s+/g, '-')}`;
                    inactiveUsers.push({
                        uid: inactiveId,
                        email: derivedEmail,
                        name: className,
                        photoURL: '/files/default-profile.png',
                        crushes: [],
                        lockedCrushes: [],
                        matches: [],
                        crushCount: crushCount,
                        userClass: 'gsb',
                        isInactive: true,
                        createdAt: null,
                        updatedAt: null,
                        lastLogin: null
                    });
                } else {
                    const ghostId = `ghost-gsb-${normalizeName(className).replace(/\s+/g, '-')}`;
                    ghostUsers.push({
                        uid: ghostId,
                        email: derivedEmail,
                        name: className,
                        photoURL: '/files/default-profile.png',
                        crushes: [],
                        lockedCrushes: [],
                        matches: [],
                        crushCount: 0,
                        userClass: 'gsb',
                        isGhost: true,
                        createdAt: null,
                        updatedAt: null,
                        lastLogin: null
                    });
                }
            });

            // Process Undergrad class members
            UNDERGRAD_CLASS_NAMES.forEach(className => {
                if (realUserNames.has(className)) {
                    return;
                }

                let crushCount = 0;
                realUsers.forEach(user => {
                    if (user.userClass === 'undergrad') {
                        const userCrushes = user.crushes || [];
                        if (userCrushes.includes(className)) {
                            crushCount++;
                        }
                    }
                });

                const derivedEmail = `${className.toLowerCase().replace(/\s+/g, '.')}@stanford.edu`;

                if (crushCount > 0) {
                    const inactiveId = `inactive-undergrad-${normalizeName(className).replace(/\s+/g, '-')}`;
                    inactiveUsers.push({
                        uid: inactiveId,
                        email: derivedEmail,
                        name: className,
                        photoURL: '/files/default-profile.png',
                        crushes: [],
                        lockedCrushes: [],
                        matches: [],
                        crushCount: crushCount,
                        userClass: 'undergrad',
                        isInactive: true,
                        createdAt: null,
                        updatedAt: null,
                        lastLogin: null
                    });
                } else {
                    const ghostId = `ghost-undergrad-${normalizeName(className).replace(/\s+/g, '-')}`;
                    ghostUsers.push({
                        uid: ghostId,
                        email: derivedEmail,
                        name: className,
                        photoURL: '/files/default-profile.png',
                        crushes: [],
                        lockedCrushes: [],
                        matches: [],
                        crushCount: 0,
                        userClass: 'undergrad',
                        isGhost: true,
                        createdAt: null,
                        updatedAt: null,
                        lastLogin: null
                    });
                }
            });

            const allUsersArray = [...realUsers, ...inactiveUsers, ...ghostUsers];

            // Sort by class first, then by type, then alphabetically
            allUsersArray.sort((a, b) => {
                const aClass = (a.userClass || 'gsb');
                const bClass = (b.userClass || 'gsb');

                // Sort by class first (GSB then Undergrad)
                if (aClass !== bClass) {
                    return aClass === 'gsb' ? -1 : 1;
                }

                const aIsInactive = (a as InactiveUser).isInactive || false;
                const bIsInactive = (b as InactiveUser).isInactive || false;
                const aIsGhost = (a as GhostUser).isGhost || false;
                const bIsGhost = (b as GhostUser).isGhost || false;

                // Within same class: Active users first, then inactive, then ghost
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
            // Check for permission denied errors
            if (error.code === 'permission-denied') {
                setAdminAccessDenied(true);
            }
        } finally {
            setLoadingUsers(false);
        }
    }, [normalizeName, user?.email]);

    useEffect(() => {
        if (user?.email === 'jpark22@stanford.edu') {
            loadAllUsers();
        }
    }, [user, loadAllUsers]);

    // Calculate analytics for both classes
    useEffect(() => {
        if (allUsers.length > 0 && user?.email === 'jpark22@stanford.edu') {
            setLoadingAnalytics(true);

            const timeoutId = setTimeout(() => {
                try {
                    const gsbData = calculateClassAnalytics('gsb');
                    const undergradData = calculateClassAnalytics('undergrad');

                    setGsbAnalytics(gsbData);
                    setUndergradAnalytics(undergradData);
                } finally {
                    setLoadingAnalytics(false);
                }
            }, 300);

            return () => clearTimeout(timeoutId);
        }
    }, [allUsers, calculateClassAnalytics, refreshKey, user?.email]);

    // Get current class data
    const currentClassUsers = useMemo(() => {
        return allUsers.filter(user => (user.userClass || 'gsb') === classView);
    }, [allUsers, classView]);

    const currentClassStats = useMemo(() => {
        const realUsers = currentClassUsers.filter(u =>
            !(u as InactiveUser).isInactive && !(u as GhostUser).isGhost
        );
        const inactiveUsers = currentClassUsers.filter(u => (u as InactiveUser).isInactive);
        const ghostUsers = currentClassUsers.filter(u => (u as GhostUser).isGhost);

        return {
            activeUsers: realUsers.length,
            inactiveUsers: inactiveUsers.length,
            ghostUsers: ghostUsers.length,
            total: currentClassUsers.length
        };
    }, [currentClassUsers]);

    const handleViewUser = useCallback((userId: string) => {
        setViewingUserId(viewingUserId === userId ? null : userId);
    }, [viewingUserId]);

    const handleRefresh = useCallback(async () => {
        setRefreshKey(prev => prev + 1);
        await loadAllUsers();
    }, [loadAllUsers]);

    const currentAnalytics = classView === 'gsb' ? gsbAnalytics : undergradAnalytics;
    const classDisplayName = classView === 'gsb' ? 'GSB MBA' : 'Undergraduate';

    return (
        <div className="admin-section">
            <div className="admin-header-section">
                <div className="admin-title-row">
                    <h3>Admin Dashboard</h3>
                    <button onClick={handleRefresh} className="admin-refresh-btn" disabled={loadingUsers || loadingAnalytics}>
                        {loadingUsers || loadingAnalytics ? '↻ Loading...' : '↻ Refresh'}
                    </button>
                </div>

                <div className="admin-definitions">
                    <p><strong>Class Separation:</strong> The system maintains strict class boundaries - GSB students can only match with GSB students, and undergrads can only match with undergrads.</p>
                    <p><strong>Active Users:</strong> Students who have signed up and can match within their class.</p>
                    <p><strong>Inactive Users:</strong> Students from the class roster who haven't signed up yet but are receiving crushes.</p>
                    <p><strong>Ghost Users:</strong> Students from the class roster with zero engagement.</p>
                </div>
            </div>

            {/* Class Selection */}
            <div className="admin-class-nav">
                <button
                    onClick={() => setClassView('gsb')}
                    className={`admin-class-btn ${classView === 'gsb' ? 'active' : ''}`}
                    disabled={loadingUsers}
                >
                    GSB MBA Class ({gsbAnalytics?.totalUsers || 0} active)
                </button>
                <button
                    onClick={() => setClassView('undergrad')}
                    className={`admin-class-btn ${classView === 'undergrad' ? 'active' : ''}`}
                    disabled={loadingUsers}
                >
                    Undergrad Class ({undergradAnalytics?.totalUsers || 0} active)
                </button>
            </div>

            {/* View Mode Navigation */}
            <div className="admin-nav">
                <button
                    onClick={() => setViewMode('analytics')}
                    className={`admin-nav-btn ${viewMode === 'analytics' ? 'active' : ''}`}
                    disabled={loadingAnalytics}
                >
                    {classDisplayName} Analytics {loadingAnalytics && '(Loading...)'}
                </button>
                <button
                    onClick={() => setViewMode('users')}
                    className={`admin-nav-btn ${viewMode === 'users' ? 'active' : ''}`}
                    disabled={loadingUsers}
                >
                    {classDisplayName} Users ({currentClassStats.total}) {loadingUsers && '(Loading...)'}
                </button>
            </div>

            <div className="admin-content">
                {viewMode === 'analytics' && (
                    <AdminAnalytics
                        analytics={currentAnalytics}
                        classView={classView}
                        classDisplayName={classDisplayName}
                    />
                )}
                {viewMode === 'users' && (
                    <AdminUsers
                        allUsers={currentClassUsers}
                        loadingUsers={loadingUsers}
                        adminSearchTerm={adminSearchTerm}
                        setAdminSearchTerm={setAdminSearchTerm}
                        userFilter={userFilter}
                        setUserFilter={setUserFilter}
                        viewingUserId={viewingUserId}
                        handleViewUser={handleViewUser}
                        findCrushersForUser={findCrushersForUser}
                        userStats={currentClassStats}
                        classView={classView}
                        classDisplayName={classDisplayName}
                    />
                )}
            </div>
        </div>
    );
};

export default AdminView;