import React, { useState, useMemo, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
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

type UserFilter = 'all' | 'active' | 'ghost' | 'inactive';

interface AdminViewProps {
    user: any;
}

const AdminView: React.FC<AdminViewProps> = ({ user }) => {
    const [allUsers, setAllUsers] = useState<(UserData | GhostUser)[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [adminSearchTerm, setAdminSearchTerm] = useState('');
    const [viewingUserId, setViewingUserId] = useState<string | null>(null);
    const [userFilter, setUserFilter] = useState<UserFilter>('all');

    const normalizeName = useCallback((name: string): string => {
        if (!name || typeof name !== 'string') return '';
        return name.trim().toLowerCase().replace(/\s+/g, ' ');
    }, []);

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

    React.useEffect(() => {
        if (user) {
            loadAllUsers();
        }
    }, [user, loadAllUsers]);

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

    return (
        <div className="admin-section">
            <h3>Admin View - User Data</h3>

            <div className="admin-definitions">
                <div className="admin-definition-grid">
                    <div className="admin-definition-card active-definition">
                        <div className="admin-definition-header">
                            <h4>Active Users</h4>
                        </div>
                        <p>Those who have created accounts and verified their names. They can send crushes and receive matches.</p>
                    </div>

                    <div className="admin-definition-card ghost-definition">
                        <div className="admin-definition-header">
                            <br></br>
                            <h4>Ghost Users</h4>
                        </div>
                        <p>Those who haven't signed up yet but are receiving crushes from active users.</p>
                    </div>

                    <div className="admin-definition-card inactive-definition">
                        <div className="admin-definition-header">
                            <br></br>
                            <h4>Inactive Users</h4>
                        </div>
                        <p>Those who haven't signed up and are not receiving any crushes.</p>
                        <br></br>
                    </div>
                </div>
            </div>

            <div className="admin-stats-summary">
                <div className="admin-stat-item">
                    <span className="admin-stat-number">{userStats.realUsers}</span>
                    <span className="admin-stat-label">Active Users</span>
                </div>
                <div className="admin-stat-item">
                    <span className="admin-stat-number">{userStats.ghostsWithCrushes}</span>
                    <span className="admin-stat-label">Ghost Users</span>
                </div>
                <div className="admin-stat-item">
                    <span className="admin-stat-number">{userStats.ghostsWithoutCrushes}</span>
                    <span className="admin-stat-label">Inactive Users</span>
                </div>
                <div className="admin-stat-item">
                    <span className="admin-stat-number">{GSB_CLASS_NAMES.length}</span>
                    <span className="admin-stat-label">Total Class</span>
                </div>
            </div>

            <div className="admin-controls">
                <div className="admin-search-section">
                    <input
                        type="text"
                        placeholder="Search users by name or email..."
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
};

export default AdminView;