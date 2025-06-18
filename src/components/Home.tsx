import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { doc, updateDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
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
    uid: string; // Will be 'ghost-' + normalized name
    email: string; // Will be derived email
    displayName: string;
    photoURL: string;
    verifiedName: string;
    crushes: string[];
    lockedCrushes: string[];
    matches: MatchInfo[];
    crushCount: number;
    isGhost: boolean;
    ghostType: 'with-crushes' | 'no-crushes'; // Track type of ghost
    createdAt: any;
    updatedAt: any;
    lastLogin: any;
}

type UserFilter = 'all' | 'active' | 'ghost' | 'inactive';

const Home: React.FC = () => {
    const { user, userData, logout, refreshUserData } = useAuth();
    const [imageError, setImageError] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedNames, setSelectedNames] = useState<string[]>([]);
    const [savedNames, setSavedNames] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Admin view state
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [allUsers, setAllUsers] = useState<(UserData | GhostUser)[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [adminSearchTerm, setAdminSearchTerm] = useState('');
    const [viewingUserId, setViewingUserId] = useState<string | null>(null);
    const [userFilter, setUserFilter] = useState<UserFilter>('all');

    const isAdmin = user?.email === 'jpark22@stanford.edu';

    // Helper function to normalize names
    const normalizeName = useCallback((name: string): string => {
        if (!name || typeof name !== 'string') return '';
        return name.trim().toLowerCase().replace(/\s+/g, ' ');
    }, []);

    // Helper function to find who is crushing on a specific user
    const findCrushersForUser = useCallback((targetUser: UserData | GhostUser): CrusherInfo[] => {
        const crushers: CrusherInfo[] = [];
        const targetName = targetUser.verifiedName;

        if (!targetName) return crushers;

        allUsers.forEach(u => {
            if (u.uid === targetUser.uid || (u as GhostUser).isGhost) return; // Skip self and other ghosts

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
        if (!isAdmin) return;

        setLoadingUsers(true);
        try {
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const realUsers: UserData[] = [];

            // Load all real users
            usersSnapshot.forEach(doc => {
                const data = doc.data() as UserData;
                realUsers.push({
                    ...data,
                    uid: doc.id
                });
            });

            // Find all unique crush names across all users
            const allCrushNames = new Set<string>();
            realUsers.forEach(user => {
                const userCrushes = user.crushes || [];
                userCrushes.forEach(crushName => {
                    allCrushNames.add(crushName);
                });
            });

            // Get all real user names (people who have signed up)
            const realUserNames = new Set(realUsers.map(u => u.verifiedName).filter(Boolean));

            // Create ghost users for ALL class members who haven't signed up
            const ghostUsers: GhostUser[] = [];

            GSB_CLASS_NAMES.forEach(className => {
                // Skip if this person has already signed up
                if (realUserNames.has(className)) {
                    return;
                }

                // Count how many people are crushing on this person
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

            // Combine real users and ghost users
            const allUsersArray = [...realUsers, ...ghostUsers];

            // Sort by type first (real users, then ghosts with crushes, then ghosts without crushes)
            // Then by name within each category
            allUsersArray.sort((a, b) => {
                const aIsGhost = (a as GhostUser).isGhost || false;
                const bIsGhost = (b as GhostUser).isGhost || false;
                const aGhostType = (a as GhostUser).ghostType;
                const bGhostType = (b as GhostUser).ghostType;

                // Priority: real users > ghosts with crushes > ghosts without crushes
                if (!aIsGhost && bIsGhost) return -1;
                if (aIsGhost && !bIsGhost) return 1;
                if (aIsGhost && bIsGhost) {
                    if (aGhostType === 'with-crushes' && bGhostType === 'no-crushes') return -1;
                    if (aGhostType === 'no-crushes' && bGhostType === 'with-crushes') return 1;
                }

                // Within same category, sort by name
                const nameA = a.verifiedName || a.displayName || a.email || '';
                const nameB = b.verifiedName || b.displayName || b.email || '';
                return nameA.localeCompare(nameB);
            });

            setAllUsers(allUsersArray);

            const realUsersCount = realUsers.length;
            const ghostsWithCrushes = ghostUsers.filter(g => g.ghostType === 'with-crushes').length;
            const ghostsWithoutCrushes = ghostUsers.filter(g => g.ghostType === 'no-crushes').length;

            console.log(`Loaded ${realUsersCount} real users, ${ghostsWithCrushes} ghosts with crushes, ${ghostsWithoutCrushes} ghosts without crushes`);

        } catch (error) {
            console.error('Error loading all users:', error);
        } finally {
            setLoadingUsers(false);
        }
    }, [isAdmin, normalizeName]);

    const filteredUsers = useMemo(() => {
        let users = allUsers;

        // Filter by user type
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
                // Show all users
                break;
        }

        // Filter by search term
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

    const loadUserSelections = useCallback(async () => {
        if (!user) return;

        try {
            const userRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
                const data = userDoc.data();
                if (data.crushes && Array.isArray(data.crushes)) {
                    setSelectedNames(data.crushes);
                    setSavedNames(data.crushes);
                }
            }
        } catch (error) {
            console.error('Error loading user selections:', error);
            setError('Failed to load your previous selections.');
        }
    }, [user]);

    useEffect(() => {
        const loadData = async () => {
            try {
                setError(null);
                if (user) {
                    await loadUserSelections();
                    if (isAdmin) {
                        await loadAllUsers();
                    }
                }
            } catch (error) {
                console.error('Error loading data:', error);
                setError('Failed to load your data. Please refresh the page.');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [user, loadUserSelections, loadAllUsers, isAdmin]);

    const filteredAvailableNames = useMemo(() => {
        const excludedNames = [...selectedNames];

        if (userData?.verifiedName) {
            excludedNames.push(userData.verifiedName);
        }

        const availableNames = GSB_CLASS_NAMES.filter(name => !excludedNames.includes(name));

        if (!searchTerm) return availableNames;

        return availableNames.filter(name =>
            name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [selectedNames, searchTerm, userData?.verifiedName]);

    const handleImageError = useCallback(() => {
        setImageError(true);
    }, []);

    const getProfileImageUrl = useCallback(() => {
        if (imageError) {
            return '/files/default-profile.png';
        }
        return userData?.photoURL || '/files/default-profile.png';
    }, [imageError, userData?.photoURL]);

    const handleNameToggle = useCallback((name: string) => {
        if (updating) return;

        setSelectedNames(prev =>
            prev.includes(name)
                ? prev.filter(n => n !== name)
                : [...prev, name]
        );
    }, [updating]);

    const handleRemoveSelected = useCallback((nameToRemove: string) => {
        if (updating) return;

        const lockedCrushes = userData?.lockedCrushes || [];
        if (lockedCrushes.includes(nameToRemove)) {
            return;
        }

        setSelectedNames(prev => prev.filter(name => name !== nameToRemove));
    }, [updating, userData?.lockedCrushes]);

    const handleUpdatePreferences = useCallback(async () => {
        if (!user || updating) return;

        const lockedCrushes = userData?.lockedCrushes || [];
        const missingLockedCrushes = lockedCrushes.filter(locked => !selectedNames.includes(locked));

        if (missingLockedCrushes.length > 0) {
            const restoredNames = [...new Set([...selectedNames, ...lockedCrushes])];
            setSelectedNames(restoredNames);
        }

        setUpdating(true);
        setError(null);

        try {
            const userRef = doc(db, 'users', user.uid);
            const finalCrushes = [...new Set([...selectedNames, ...lockedCrushes])];

            await updateDoc(userRef, {
                crushes: finalCrushes,
                updatedAt: new Date()
            });

            setSelectedNames(finalCrushes);
            setSavedNames(finalCrushes);
            await refreshUserData();

            const successDiv = document.createElement('div');
            successDiv.textContent = 'Preferences updated successfully!';
            successDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #28a745;
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                z-index: 1000;
                font-weight: 500;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            `;
            document.body.appendChild(successDiv);

            setTimeout(() => {
                if (document.body.contains(successDiv)) {
                    document.body.removeChild(successDiv);
                }
            }, 3000);

        } catch (error) {
            console.error('Error updating preferences:', error);
            setError('Failed to update preferences. Please try again.');
        } finally {
            setUpdating(false);
        }
    }, [user, updating, selectedNames, userData?.lockedCrushes, refreshUserData]);

    const handleAdminSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAdminSearchTerm(e.target.value);
    };

    const handleViewUser = (userId: string) => {
        setViewingUserId(viewingUserId === userId ? null : userId);
    };

    // Get summary stats for display
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

    if (loading) {
        return <div className="loading">Loading...</div>;
    }

    if (error) {
        return (
            <div className="loading">
                <p style={{ color: 'red' }}>{error}</p>
                <button onClick={() => window.location.reload()}>Refresh Page</button>
            </div>
        );
    }

    const hasMatches = userData?.matches && userData.matches.length > 0;
    const crushCount = userData?.crushCount || 0;
    const lockedCrushes = userData?.lockedCrushes || [];
    const hasUnsavedChanges = JSON.stringify(selectedNames.sort()) !== JSON.stringify(savedNames.sort());

    return (
        <div className="dashboard-container">
            <div className="dashboard-card">
                <div className="dashboard-header">
                    <h1>Stanford Last Chances</h1>
                    <div className="user-info">
                        <div className="user-details">
                            <img
                                src={getProfileImageUrl()}
                                alt="Profile"
                                className="profile-pic"
                                onError={handleImageError}
                                onLoad={() => setImageError(false)}
                            />
                            <div>
                                <div className="user-name">{userData?.verifiedName || userData?.displayName || user?.displayName}</div>
                                <div className="user-email">{user?.email}</div>
                            </div>
                        </div>
                        <div className="header-actions">
                            {isAdmin && (
                                <button
                                    onClick={() => setIsAdminMode(!isAdminMode)}
                                    className="admin-toggle-btn"
                                >
                                    {isAdminMode ? 'Exit Admin View' : 'Admin View'}
                                </button>
                            )}
                            <button className="logout-btn" onClick={logout}>Logout</button>
                        </div>
                    </div>
                </div>

                <div className="dashboard-content">
                    {isAdminMode && isAdmin ? (
                        <div className="admin-section">
                            <h3>Admin View - User Data</h3>

                            {/* User Type Definitions */}
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

                                        // Display name priority: verifiedName > displayName > email
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
                    ) : (
                        <>
                            {crushCount > 0 && (
                                <div className="crush-count-section">
                                    <h2>{crushCount} {crushCount === 1 ? 'person is' : 'people are'} crushing on you!</h2>
                                </div>
                            )}

                            {hasMatches && (
                                <div className="matches-section">
                                    <h2>🎉 You have {userData.matches.length} match{userData.matches.length > 1 ? 'es' : ''}!</h2>
                                    <div className="matches-list">
                                        {userData.matches.map((match, index) => (
                                            <div key={index} className="match-item">
                                                <div className="match-name">{match.name}</div>
                                                <div className="match-email">{match.email}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="header-section">
                                <div className="instructions">
                                    <ol>
                                        <li>Select any classmates you'd like to connect with. Your selections are completely private - only you can see who you've chosen.</li>
                                        <li>Click "Update Preferences" to save your changes. Matches appear automatically when someone you've selected also selects you. Matches are completely private.</li>
                                        <li>You can add or remove names anytime. There's no limit on how many people you can select, and you can change your preferences as often as you want.</li>
                                        <li>Once you match with someone, you cannot remove them from your list.</li>
                                    </ol>
                                </div>
                            </div>

                            <div className="selection-counter">
                                {selectedNames.length} selected
                                {hasUnsavedChanges && <span className="unsaved-badge">UNSAVED CHANGES</span>}
                            </div>

                            {selectedNames.length > 0 && (
                                <div className="selected-names">
                                    <h3>Your Selections ({selectedNames.length})</h3>
                                    <div className="name-chips">
                                        {selectedNames.map(name => {
                                            const isLocked = lockedCrushes.includes(name);
                                            return (
                                                <div key={name} className={`name-chip ${isLocked ? 'locked' : 'selected'}`}>
                                                    <span>{name}</span>
                                                    {isLocked ? (
                                                        <span className="lock-icon" title="Locked - you have matched with this person">🔒</span>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleRemoveSelected(name)}
                                                            className="remove-btn"
                                                            aria-label={`Remove ${name}`}
                                                            disabled={updating}
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="search-section">
                                <input
                                    type="text"
                                    placeholder="Search names..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="search-input"
                                />
                            </div>

                            <div className="available-names">
                                <h3>
                                    Classmates
                                    {searchTerm && ` (${filteredAvailableNames.length} found)`}
                                </h3>
                                <div className="names-simple-list">
                                    {filteredAvailableNames.map(name => (
                                        <div
                                            key={name}
                                            onClick={() => !updating && handleNameToggle(name)}
                                            className={`name-list-item ${updating ? 'disabled' : ''}`}
                                        >
                                            <span className="name-text">{name}</span>
                                            <span className="add-btn">+</span>
                                        </div>
                                    ))}
                                    {filteredAvailableNames.length === 0 && (
                                        <div className="no-results">
                                            {searchTerm ? 'No names found matching your search.' : 'All classmates have been selected!'}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="action-section">
                                <div className="action-buttons">
                                    <button
                                        onClick={handleUpdatePreferences}
                                        disabled={updating || !hasUnsavedChanges}
                                        className="update-btn"
                                    >
                                        {updating ? 'Updating...' : 'Update Preferences'}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="error-message" style={{ color: 'red', textAlign: 'center', marginTop: '15px' }}>
                                    {error}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Home;