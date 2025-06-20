import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { GSB_CLASS_NAMES } from '../data/names';

interface MatchInfo {
    name: string;
    email: string;
}

interface UserData {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string;
    verifiedName: string;
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

interface GhostUser {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string;
    verifiedName: string;
    crushes: string[];
    lockedCrushes: string[];
    matches: MatchInfo[];
    crushCount: number;
    isGhost: boolean;
    ghostType: 'with-crushes' | 'no-crushes';
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
    activeUsersLast24h?: number;
}

type UserFilter = 'all' | 'active' | 'ghost' | 'inactive';
type ViewMode = 'analytics' | 'users';

interface AdminViewProps {
    user: any;
}

const AdminView: React.FC<AdminViewProps> = ({ user }) => {
    const [allUsers, setAllUsers] = useState<(UserData | GhostUser)[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [adminSearchTerm, setAdminSearchTerm] = useState('');
    const [viewingUserId, setViewingUserId] = useState<string | null>(null);
    const [userFilter, setUserFilter] = useState<UserFilter>('all');
    const [viewMode, setViewMode] = useState<ViewMode>('analytics');
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [liveAnalytics, setLiveAnalytics] = useState<FirebaseAnalyticsData | null>(null);

    const normalizeName = useCallback((name: string): string => {
        if (!name || typeof name !== 'string') return '';
        return name.trim().toLowerCase().replace(/\s+/g, ' ');
    }, []);

    const findUserByName = useCallback((crushName: string, users: (UserData | GhostUser)[]): UserData | GhostUser | null => {
        if (!crushName || !crushName.trim()) return null;

        const normalizedCrush = normalizeName(crushName);

        // First try exact match on verifiedName
        let match = users.find(user =>
            user.verifiedName &&
            normalizeName(user.verifiedName) === normalizedCrush
        );

        if (match) return match;

        // Try exact match on displayName as fallback
        match = users.find(user =>
            user.displayName &&
            normalizeName(user.displayName) === normalizedCrush
        );

        if (match) return match;

        // Try partial match (first and last name only)
        const crushParts = normalizedCrush.split(' ');
        if (crushParts.length >= 2) {
            const crushFirstLast = `${crushParts[0]} ${crushParts[crushParts.length - 1]}`;

            // Try partial match with verifiedName
            match = users.find(user => {
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
            match = users.find(user => {
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
    }, [normalizeName]);

    const findCrushersForUser = useCallback((targetUser: UserData | GhostUser): CrusherInfo[] => {
        const crushers: CrusherInfo[] = [];
        const targetName = targetUser.verifiedName;

        if (!targetName) return crushers;

        allUsers.forEach(u => {
            if (u.uid === targetUser.uid || (u as GhostUser).isGhost) return;

            const userCrushes = u.crushes || [];
            if (userCrushes.includes(targetName)) {
                crushers.push({
                    name: u.verifiedName || u.displayName,
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
                setLiveAnalytics(latestAnalytics);
                console.log('Live analytics updated:', latestAnalytics);
            }
        }, (error) => {
            console.error('Error listening to analytics:', error);
        });

        return () => unsubscribe();
    }, []);

    const calculateAnalytics = useCallback((): AnalyticsData => {
        const realUsers = allUsers.filter(u => !(u as GhostUser).isGhost) as UserData[];

        // Basic stats
        const totalUsers = realUsers.length;
        const totalTakenNames = realUsers.filter(u => u.verifiedName && u.verifiedName.trim()).length;

        // Calculate matches
        const seenPairs = new Set<string>();
        realUsers.forEach(user => {
            const matches = user.matches || [];
            if (Array.isArray(matches) && matches.length > 0) {
                matches.forEach(match => {
                    const matchName = match.name || match;
                    const pair = [user.verifiedName || user.displayName, matchName].sort().join(' ↔ ');
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
                    const actualName = targetUser.verifiedName || targetUser.displayName;
                    if (actualName) {
                        crushCounts.set(actualName, (crushCounts.get(actualName) || 0) + 1);
                        if (!crushersMap.has(actualName)) {
                            crushersMap.set(actualName, []);
                        }
                        crushersMap.get(actualName)!.push(user.verifiedName || user.displayName);
                    }
                } else {
                    crushCounts.set(crushName, (crushCounts.get(crushName) || 0) + 1);
                    if (!crushersMap.has(crushName)) {
                        crushersMap.set(crushName, []);
                    }
                    crushersMap.get(crushName)!.push(user.verifiedName || user.displayName);
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
                name: user.verifiedName || user.displayName,
                count: user.crushes.length,
                crushNames: user.crushes
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);

        // Inactive receivers (people with crushes who haven't submitted)
        const inactiveReceivers: Array<{ name: string; email: string; crushCount: number; reason: string; crushers: CrusherInfo[] }> = [];

        realUsers.forEach(user => {
            if (user.crushCount > 0) {
                const hasVerifiedName = !!(user.verifiedName && user.verifiedName.trim());
                const hasSubmittedCrushes = !!(user.crushes && user.crushes.length > 0);

                if (!hasVerifiedName || !hasSubmittedCrushes) {
                    const crushers = findCrushersForUser(user);

                    let reason = '';
                    if (!hasVerifiedName && !hasSubmittedCrushes) {
                        reason = 'No verified name and no crushes submitted';
                    } else if (!hasVerifiedName) {
                        reason = 'No verified name';
                    } else if (!hasSubmittedCrushes) {
                        reason = 'No crushes submitted';
                    }

                    inactiveReceivers.push({
                        name: user.verifiedName || user.displayName,
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
            activeUsersLast24h: liveAnalytics?.activeUsersLast24h
        };
    }, [allUsers, findUserByName, findCrushersForUser, liveAnalytics]);

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

            const allCrushNames = new Set<string>();
            realUsers.forEach(user => {
                const userCrushes = user.crushes || [];
                userCrushes.forEach(crushName => {
                    allCrushNames.add(crushName);
                });
            });

            const realUserNames = new Set(realUsers.map(u => u.verifiedName).filter(Boolean));
            const ghostUsers: GhostUser[] = [];

            GSB_CLASS_NAMES.forEach(className => {
                if (realUserNames.has(className)) {
                    return;
                }

                let crushCount = 0;
                realUsers.forEach(user => {
                    const userCrushes = user.crushes || [];
                    if (userCrushes.includes(className)) {
                        crushCount++;
                    }
                });

                const ghostId = `ghost-${normalizeName(className).replace(/\s+/g, '-')}`;
                const derivedEmail = `${className.toLowerCase().replace(/\s+/g, '.')}@stanford.edu`;

                ghostUsers.push({
                    uid: ghostId,
                    email: derivedEmail,
                    displayName: className,
                    photoURL: '/files/default-profile.png',
                    verifiedName: className,
                    crushes: [],
                    lockedCrushes: [],
                    matches: [],
                    crushCount: crushCount,
                    isGhost: true,
                    ghostType: crushCount > 0 ? 'with-crushes' : 'no-crushes',
                    createdAt: null,
                    updatedAt: null,
                    lastLogin: null
                });
            });

            const allUsersArray = [...realUsers, ...ghostUsers];

            allUsersArray.sort((a, b) => {
                const aIsGhost = (a as GhostUser).isGhost || false;
                const bIsGhost = (b as GhostUser).isGhost || false;
                const aGhostType = (a as GhostUser).ghostType;
                const bGhostType = (b as GhostUser).ghostType;

                if (!aIsGhost && bIsGhost) return -1;
                if (aIsGhost && !bIsGhost) return 1;
                if (aIsGhost && bIsGhost) {
                    if (aGhostType === 'with-crushes' && bGhostType === 'no-crushes') return -1;
                    if (aGhostType === 'no-crushes' && bGhostType === 'with-crushes') return 1;
                }

                const nameA = a.verifiedName || a.displayName || a.email || '';
                const nameB = b.verifiedName || b.displayName || b.email || '';
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

    const filteredUsers = useMemo(() => {
        let users = allUsers;

        switch (userFilter) {
            case 'active':
                users = users.filter(u => !(u as GhostUser).isGhost);
                break;
            case 'ghost':
                users = users.filter(u => (u as GhostUser).isGhost && (u as GhostUser).ghostType === 'with-crushes');
                break;
            case 'inactive':
                users = users.filter(u => (u as GhostUser).isGhost && (u as GhostUser).ghostType === 'no-crushes');
                break;
            case 'all':
            default:
                break;
        }

        if (!adminSearchTerm.trim()) return users;

        const searchLower = adminSearchTerm.toLowerCase();
        return users.filter(u => {
            const verifiedName = (u.verifiedName || '').toLowerCase();
            const displayName = (u.displayName || '').toLowerCase();
            const email = (u.email || '').toLowerCase();

            return verifiedName.includes(searchLower) ||
                displayName.includes(searchLower) ||
                email.includes(searchLower);
        });
    }, [allUsers, adminSearchTerm, userFilter]);

    const userStats = useMemo(() => {
        const realUsers = allUsers.filter(u => !(u as GhostUser).isGhost);
        const ghostsWithCrushes = allUsers.filter(u => (u as GhostUser).ghostType === 'with-crushes');
        const ghostsWithoutCrushes = allUsers.filter(u => (u as GhostUser).ghostType === 'no-crushes');

        return {
            realUsers: realUsers.length,
            ghostsWithCrushes: ghostsWithCrushes.length,
            ghostsWithoutCrushes: ghostsWithoutCrushes.length,
            total: allUsers.length
        };
    }, [allUsers]);

    const handleAdminSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAdminSearchTerm(e.target.value);
    };

    const handleViewUser = (userId: string) => {
        setViewingUserId(viewingUserId === userId ? null : userId);
    };

    const renderAnalytics = () => (
        <div className="admin-overview">
            <div className="admin-quick-insights">
                <div className="admin-insight-card">
                    <h4>Platform Activity</h4>
                    <p>{analytics?.usersWithCrushes || 0} users have sent crushes</p>
                    <p>{analytics?.usersWithMatches || 0} users have matches</p>
                    <p>{analytics?.avgCrushes || 0} average crushes sent per user</p>
                    {analytics?.activeUsersLast24h !== undefined && (
                        <p>{analytics.activeUsersLast24h}% users active in last 24h</p>
                    )}
                </div>
            </div>

            <div className="admin-analytics">
                <div className="admin-analytics-section">
                    <h4>All Matches ({analytics?.totalMatches || 0})</h4>
                    {analytics?.matchedPairs.length ? (
                        <div className="admin-matches-list">
                            {analytics.matchedPairs.map((pair, index) => (
                                <div key={index} className="admin-match-item">
                                    {index + 1}. {pair}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p>No matches found yet.</p>
                    )}
                </div>

                <div className="admin-analytics-section">
                    <h4>Top Crush Receivers</h4>
                    <div className="admin-list">
                        {analytics?.topCrushReceivers.map((receiver, index) => (
                            <div key={receiver.name} className="admin-list-item">
                                <span>{index + 1}. {receiver.name}</span>
                                <span>{receiver.count} crushes</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="admin-analytics-section">
                    <h4>Top Crush Senders</h4>
                    <div className="admin-list">
                        {analytics?.topCrushSenders.map((sender, index) => (
                            <div key={sender.name} className="admin-list-item">
                                <span>{index + 1}. {sender.name}</span>
                                <span>{sender.count} crushes sent</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="admin-analytics-section">
                    <h4>Inactive Receivers ({analytics?.inactiveReceivers.length || 0})</h4>
                    <div className="admin-list">
                        {analytics?.inactiveReceivers.map((inactive, index) => (
                            <div key={inactive.email} className="admin-inactive-item">
                                <div className="admin-inactive-header">
                                    <span>{index + 1}. {inactive.name}</span>
                                    <span>{inactive.crushCount} crushes</span>
                                </div>
                                <div className="admin-inactive-details">
                                    <p>Email: {inactive.email}</p>
                                    <p>Reason: {inactive.reason}</p>
                                    <p>Crushers: {inactive.crushers.map(c => c.name).join(', ')}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    const renderUsers = () => (
        <div className="admin-users">
            <div className="admin-controls">
                <div className="admin-search-section">
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={adminSearchTerm}
                        onChange={handleAdminSearchChange}
                        className="admin-search-input"
                    />
                </div>
                <div className="admin-filter-section">
                    <select
                        value={userFilter}
                        onChange={(e) => setUserFilter(e.target.value as UserFilter)}
                        className="admin-filter-dropdown"
                    >
                        <option value="all">All Users ({userStats.total})</option>
                        <option value="active">Active Users ({userStats.realUsers})</option>
                        <option value="ghost">Ghost Users ({userStats.ghostsWithCrushes})</option>
                        <option value="inactive">Inactive Users ({userStats.ghostsWithoutCrushes})</option>
                    </select>
                </div>
            </div>

            {loadingUsers ? (
                <div className="loading">Loading users...</div>
            ) : (
                <div className="admin-users-container">
                    {filteredUsers.map(u => {
                        const isViewing = viewingUserId === u.uid;
                        const actualCrushCount = u.crushCount || 0;
                        const crushers = findCrushersForUser(u);
                        const isGhost = (u as GhostUser).isGhost || false;
                        const ghostType = (u as GhostUser).ghostType;

                        const displayName = u.verifiedName || u.displayName || u.email;
                        const hasVerifiedName = !!(u.verifiedName && u.verifiedName.trim());

                        return (
                            <div key={u.uid} className={`admin-user-item ${isGhost ? `admin-user-ghost admin-user-ghost-${ghostType}` : ''}`}>
                                <div className="admin-user-header">
                                    <div className="admin-user-info">
                                        <div className="admin-user-name">
                                            {displayName}
                                            {isGhost && ghostType === 'with-crushes' && (
                                                <span style={{ color: '#dc3545', marginLeft: '8px', fontSize: '11px' }}>
                                                    👻 Ghost User
                                                </span>
                                            )}
                                            {isGhost && ghostType === 'no-crushes' && (
                                                <span style={{ color: '#6c757d', marginLeft: '8px', fontSize: '11px' }}>
                                                    💤 Inactive User
                                                </span>
                                            )}
                                            {!isGhost && !hasVerifiedName && (
                                                <span style={{ color: '#dc3545', marginLeft: '8px', fontSize: '11px' }}>
                                                    (Not verified)
                                                </span>
                                            )}
                                        </div>
                                        <div className="admin-user-email">{u.email}</div>
                                        <div className="admin-user-stats">
                                            {actualCrushCount} crushing • {u.matches?.length || 0} matches • {u.crushes?.length || 0} selected
                                            {!isGhost && actualCrushCount !== crushers.length && (
                                                <span style={{ color: '#dc3545', marginLeft: '8px' }}>
                                                    (calc: {crushers.length})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleViewUser(u.uid)}
                                        className="admin-view-btn"
                                        disabled={isGhost && ghostType === 'no-crushes'}
                                    >
                                        {isGhost && ghostType === 'no-crushes' ? 'No Data' : (isViewing ? 'Collapse' : 'View')}
                                    </button>
                                </div>

                                {isViewing && !(isGhost && ghostType === 'no-crushes') && (
                                    <div className="admin-user-expanded">
                                        <div className="admin-view-header">
                                            <h4>Data for {displayName}:</h4>
                                        </div>

                                        <div className="admin-data-grid">
                                            <div className="admin-data-card">
                                                <div className="admin-data-number">{actualCrushCount}</div>
                                                <div className="admin-data-label">People Crushing On Them</div>
                                                {crushers.length > 0 && (
                                                    <div className="admin-data-names">
                                                        {crushers.map((crusher, idx) => (
                                                            <div key={idx} className="admin-name-item">
                                                                {crusher.name}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {!isGhost && actualCrushCount !== crushers.length && (
                                                    <div className="admin-discrepancy">
                                                        ⚠️ DB shows {actualCrushCount}, calc shows {crushers.length}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="admin-data-card">
                                                <div className="admin-data-number">{u.matches?.length || 0}</div>
                                                <div className="admin-data-label">Matches</div>
                                                {u.matches && u.matches.length > 0 && (
                                                    <div className="admin-data-names">
                                                        {u.matches.map((match, idx) => (
                                                            <div key={idx} className="admin-name-item">
                                                                {match.name}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {isGhost && (
                                                    <div className="admin-no-activity">
                                                        Ghost users cannot have matches yet
                                                    </div>
                                                )}
                                            </div>

                                            <div className="admin-data-card">
                                                <div className="admin-data-number">{u.crushes?.length || 0}</div>
                                                <div className="admin-data-label">Crushes Sent</div>
                                                {u.crushes && u.crushes.length > 0 && (
                                                    <div className="admin-data-names">
                                                        {u.crushes.map((crush, idx) => {
                                                            const isLocked = u.lockedCrushes?.includes(crush);
                                                            return (
                                                                <div key={idx} className={`admin-name-item ${isLocked ? 'locked' : ''}`}>
                                                                    {crush} {isLocked && '🔒'}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                {isGhost && (
                                                    <div className="admin-no-activity">
                                                        Ghost users haven't signed up yet
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {!isGhost && (actualCrushCount === 0 && (!u.matches || u.matches.length === 0) && (!u.crushes || u.crushes.length === 0)) && (
                                            <div className="admin-no-activity">
                                                No activity
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {filteredUsers.length === 0 && (
                        <div className="no-results">
                            {adminSearchTerm ? 'No users found.' : 'No users available.'}
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div className="admin-section">
            <h3>Admin Dashboard</h3>

            <div className="admin-definitions">
                <p><strong>Active Users:</strong> Students who have signed up, verified their Stanford email, and selected their name from the class roster. They can send crushes and receive matches.</p>

                <p><strong>Ghost Users:</strong> Students from the class roster who haven't signed up yet but are receiving crushes from active users. They appear as "taken" names but can't send crushes or see matches until they sign up.</p>

                <p><strong>Inactive Users:</strong> Students from the class roster who haven't signed up and are not receiving any crushes. They don't appear in the system except in the complete class count.</p>

                <p><strong>Inactive Receivers:</strong> Active users who are receiving crushes but haven't engaged properly - either they haven't verified their name or haven't sent any crushes themselves. These users need follow-up.</p>
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
                {viewMode === 'analytics' && renderAnalytics()}
                {viewMode === 'users' && renderUsers()}
            </div>
        </div>
    );
};

export default AdminView;