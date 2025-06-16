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
    const [allUsers, setAllUsers] = useState<UserData[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [adminSearchTerm, setAdminSearchTerm] = useState('');
    const [viewingUserId, setViewingUserId] = useState<string | null>(null);

    const isAdmin = user?.email === 'jpark22@stanford.edu';

    // Helper function to find who is crushing on a specific user
    const findCrushersForUser = useCallback((targetUser: UserData): CrusherInfo[] => {
        const crushers: CrusherInfo[] = [];
        const targetName = targetUser.verifiedName;

        if (!targetName) return crushers;

        allUsers.forEach(u => {
            if (u.uid === targetUser.uid) return; // Skip self

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
            const users: UserData[] = [];

            usersSnapshot.forEach(doc => {
                const data = doc.data() as UserData;
                if (data.verifiedName) {
                    users.push({
                        ...data,
                        uid: doc.id
                    });
                }
            });

            users.sort((a, b) => (a.verifiedName || '').localeCompare(b.verifiedName || ''));
            setAllUsers(users);
        } catch (error) {
            console.error('Error loading all users:', error);
        } finally {
            setLoadingUsers(false);
        }
    }, [isAdmin]);

    const filteredUsers = useMemo(() => {
        if (!adminSearchTerm.trim()) return allUsers;

        const searchLower = adminSearchTerm.toLowerCase();
        return allUsers.filter(u =>
            u.verifiedName.toLowerCase().includes(searchLower) ||
            u.email.toLowerCase().includes(searchLower)
        );
    }, [allUsers, adminSearchTerm]);

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

                            <div className="admin-search-section">
                                <input
                                    type="text"
                                    placeholder="Search users by name or email..."
                                    value={adminSearchTerm}
                                    onChange={handleAdminSearchChange}
                                    className="admin-search-input"
                                />
                            </div>

                            {loadingUsers ? (
                                <div className="loading">Loading users...</div>
                            ) : (
                                <div className="admin-users-container">
                                    {filteredUsers.map(u => {
                                        const isViewing = viewingUserId === u.uid;
                                        const actualCrushCount = u.crushCount || 0;
                                        const crushers = findCrushersForUser(u);

                                        return (
                                            <div key={u.uid} className="admin-user-item">
                                                <div className="admin-user-header">
                                                    <div className="admin-user-info">
                                                        <div className="admin-user-name">{u.verifiedName}</div>
                                                        <div className="admin-user-email">{u.email}</div>
                                                        <div className="admin-user-stats">
                                                            {actualCrushCount} crushing • {u.matches?.length || 0} matches • {u.crushes?.length || 0} selected
                                                            {actualCrushCount !== crushers.length && (
                                                                <span style={{ color: '#dc3545', marginLeft: '8px' }}>
                                                                    (calc: {crushers.length})
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleViewUser(u.uid)}
                                                        className="admin-view-btn"
                                                    >
                                                        {isViewing ? 'Collapse' : 'View'}
                                                    </button>
                                                </div>

                                                {isViewing && (
                                                    <div className="admin-user-expanded">
                                                        <div className="admin-view-header">
                                                            <h4>Data for {u.verifiedName}:</h4>
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
                                                                {actualCrushCount !== crushers.length && (
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
                                                            </div>
                                                        </div>

                                                        {(actualCrushCount === 0 && (!u.matches || u.matches.length === 0) && (!u.crushes || u.crushes.length === 0)) && (
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