import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { UserData, MatchInfo, UserClass } from '../../types';

interface CrusherInfo {
    name: string;
    email: string;
}

interface InactiveUser {
    uid: string;
    email: string;
    emailAlumni?: string;
    emailAlumniGSB?: string;
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
    emailAlumni?: string;
    emailAlumniGSB?: string;
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

type UserFilter = 'all' | 'active' | 'inactive' | 'ghost';

interface AdminUsersProps {
    allUsers: (UserData | InactiveUser | GhostUser)[];
    loadingUsers: boolean;
    adminSearchTerm: string;
    setAdminSearchTerm: (term: string) => void;
    userFilter: UserFilter;
    setUserFilter: (filter: UserFilter) => void;
    viewingUserId: string | null;
    handleViewUser: (userId: string) => void;
    findCrushersForUser: (user: UserData | InactiveUser | GhostUser) => CrusherInfo[];
    userStats: {
        activeUsers: number;
        inactiveUsers: number;
        ghostUsers: number;
        total: number;
    };
    classView: 'gsb' | 'undergrad';
    classDisplayName: string;
    onRefresh: () => void;
}

// Helper function to format match timestamp for admin view
const formatAdminMatchTimestamp = (matchedAt: any): string => {
    if (!matchedAt) return 'Unknown';

    let date: Date;

    // Handle Firestore Timestamp
    if (matchedAt && typeof matchedAt.toDate === 'function') {
        date = matchedAt.toDate();
    } else if (matchedAt && matchedAt.seconds) {
        date = new Date(matchedAt.seconds * 1000);
    } else if (matchedAt instanceof Date) {
        date = matchedAt;
    } else {
        date = new Date(matchedAt);
    }

    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
        return 'Just now';
    } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours}h ago`;
    } else if (diffInSeconds < 604800) {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days}d ago`;
    } else {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }
};

// Use the exact same search function as the normal user search
const matchesSearchTerm = (searchableText: string, searchTerm: string): { matches: boolean; score: number } => {
    if (!searchTerm.trim()) return { matches: true, score: 0 };

    const normalizeText = (text: string) => text.toLowerCase().trim();
    const normalizedText = normalizeText(searchableText);
    const normalizedSearch = normalizeText(searchTerm);

    // Exact substring match (highest priority)
    if (normalizedText.includes(normalizedSearch)) {
        return { matches: true, score: 100 };
    }

    const textParts = normalizedText.split(' ').filter(Boolean);
    const searchParts = normalizedSearch.split(' ').filter(Boolean);

    // First + Last name matching (most common use case)
    if (searchParts.length >= 2) {
        const searchFirst = searchParts[0];
        const searchLast = searchParts[searchParts.length - 1];

        if (textParts.length >= 2) {
            const textFirst = textParts[0];
            const textLast = textParts[textParts.length - 1];

            // Exact first + last match
            if (textFirst === searchFirst && textLast === searchLast) {
                return { matches: true, score: 95 };
            }

            // Partial first + exact last
            if (textFirst.startsWith(searchFirst) && textLast === searchLast) {
                return { matches: true, score: 90 };
            }

            // Exact first + partial last
            if (textFirst === searchFirst && textLast.startsWith(searchLast)) {
                return { matches: true, score: 85 };
            }
        }
    }

    // Single term matching
    if (searchParts.length === 1) {
        const searchTerm = searchParts[0];

        // Check if any text part starts with search term
        if (textParts.some(part => part.startsWith(searchTerm))) {
            return { matches: true, score: 80 };
        }
    }

    // Multi-word progressive matching
    let textIndex = 0;
    let matchedParts = 0;

    for (const searchPart of searchParts) {
        for (let i = textIndex; i < textParts.length; i++) {
            if (textParts[i].startsWith(searchPart)) {
                matchedParts++;
                textIndex = i + 1;
                break;
            }
        }
    }

    if (matchedParts === searchParts.length) {
        return { matches: true, score: 75 };
    }

    return { matches: false, score: 0 };
};

// Simple function that just returns the text without highlighting
const highlightMatch = (text: string, _searchTerm: string) => {
    return text;
};

const AdminUsers: React.FC<AdminUsersProps> = ({
    allUsers,
    loadingUsers,
    adminSearchTerm,
    setAdminSearchTerm,
    userFilter,
    setUserFilter,
    viewingUserId,
    handleViewUser,
    findCrushersForUser,
    userStats,
    classDisplayName,
    onRefresh
}) => {
    const searchInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRestoreRef = useRef<{ scrollTop: number; timestamp: number } | null>(null);

    // Unlinking state
    const [unlinkingUserId, setUnlinkingUserId] = useState<string | null>(null);
    const [unlinkingInProgress, setUnlinkingInProgress] = useState(false);
    const [unlinkError, setUnlinkError] = useState<string | null>(null);
    const [unlinkSuccess, setUnlinkSuccess] = useState<string | null>(null);

    // Reset scroll when search term or filter changes
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = 0;
            scrollRestoreRef.current = null;
        }
    }, [adminSearchTerm, userFilter]);

    // Restore scroll position after viewingUserId changes
    useEffect(() => {
        if (scrollRestoreRef.current && containerRef.current) {
            const { scrollTop, timestamp } = scrollRestoreRef.current;

            // Only restore if this is a recent change (within 100ms)
            if (Date.now() - timestamp < 100) {
                // Use multiple methods to ensure scroll restoration
                const restoreScroll = () => {
                    if (containerRef.current) {
                        containerRef.current.scrollTop = scrollTop;
                    }
                };

                // Immediate restoration
                restoreScroll();

                // Delayed restoration to catch any layout shifts
                requestAnimationFrame(() => {
                    restoreScroll();
                    setTimeout(restoreScroll, 0);
                    setTimeout(restoreScroll, 10);
                });
            }

            // Clear the restore reference
            scrollRestoreRef.current = null;
        }
    }, [viewingUserId]);

    // Enhanced handleViewUser that captures scroll position
    const handleViewUserWithScrollPreservation = useCallback((userId: string) => {
        if (containerRef.current) {
            // Capture current scroll position with timestamp
            scrollRestoreRef.current = {
                scrollTop: containerRef.current.scrollTop,
                timestamp: Date.now()
            };
        }

        // Trigger the actual view change
        handleViewUser(userId);
    }, [handleViewUser]);

    const handleAdminSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setAdminSearchTerm(newValue);
    }, [setAdminSearchTerm]);

    // Clear search function
    const clearAdminSearch = useCallback(() => {
        setAdminSearchTerm('');
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [setAdminSearchTerm]);

    // Handle unlink account
    const handleUnlinkAccount = useCallback(async (userId: string, userData: UserData | InactiveUser | GhostUser) => {
        setUnlinkingInProgress(true);
        setUnlinkError(null);
        setUnlinkSuccess(null);

        try {
            const userRef = doc(db, 'users', userId);
            const hasAlumniEmails = !!(userData.emailAlumni || userData.emailAlumniGSB);
            const hasStanfordEmail = userData.email && userData.email.endsWith('@stanford.edu');

            if (hasAlumniEmails) {
                // TC4/5 case: Unlink alumni emails
                await updateDoc(userRef, {
                    emailAlumni: '',
                    emailAlumniGSB: '',
                    updatedAt: new Date()
                });
                setUnlinkSuccess(`Alumni emails unlinked from ${userData.name || userData.email}`);
            } else if (!hasStanfordEmail && userData.uid) {
                // TC2 case: Remove UID claim (user claimed name but used alumni email)
                await updateDoc(userRef, {
                    uid: '',
                    email: '',
                    updatedAt: new Date()
                });
                setUnlinkSuccess(`Account claim removed from ${userData.name || userData.email}`);
            } else {
                setUnlinkError('This account cannot be unlinked (has @stanford.edu email and no alumni emails)');
                setUnlinkingInProgress(false);
                setUnlinkingUserId(null);
                return;
            }

            setTimeout(() => setUnlinkSuccess(null), 3000);
            onRefresh();

        } catch (error) {
            console.error('Error unlinking account:', error);
            setUnlinkError('Failed to unlink account. Please try again.');
        } finally {
            setUnlinkingInProgress(false);
            setUnlinkingUserId(null);
        }
    }, []);

    // Use the exact same filtering logic as normal search with better debugging
    const filteredUsers = useMemo(() => {
        let users = allUsers;

        switch (userFilter) {
            case 'active':
                users = users.filter(u => !(u as InactiveUser).isInactive && !(u as GhostUser).isGhost);
                break;
            case 'inactive':
                users = users.filter(u => (u as InactiveUser).isInactive);
                break;
            case 'ghost':
                users = users.filter(u => (u as GhostUser).isGhost);
                break;
        }

        const trimmedSearch = adminSearchTerm.trim();
        if (trimmedSearch === '') return users;

        return users
            .map(user => {
                const searchableTexts = [user.name || '', user.email || ''].filter(Boolean);
                let bestMatch = { matches: false, score: 0 };
                for (const text of searchableTexts) {
                    const result = matchesSearchTerm(text, trimmedSearch);
                    if (result.matches && result.score > bestMatch.score) bestMatch = result;
                }
                return { user, ...bestMatch };
            })
            .filter(item => item.matches)
            .sort((a, b) => b.score - a.score)
            .map(item => item.user);
    }, [allUsers, adminSearchTerm, userFilter]);

    const UserItem = React.memo(({ u }: { u: UserData | InactiveUser | GhostUser }) => {
        const isViewing = viewingUserId === u.uid;
        const actualCrushCount = u.crushCount || 0;
        const crushers = findCrushersForUser(u);
        const isInactive = (u as InactiveUser).isInactive || false;
        const isGhost = (u as GhostUser).isGhost || false;

        const displayName = u.name || u.email;
        const hasName = !!(u.name && u.name.trim());

        // Determine if account can be unlinked
        const hasAlumniEmails = !!(u.emailAlumni || u.emailAlumniGSB);
        const hasStanfordEmail = u.email && u.email.endsWith('@stanford.edu');
        const canUnlink = hasAlumniEmails || (!hasStanfordEmail && u.uid);

        let userTypeClass = '';
        let userTypeLabel = '';

        if (isGhost) {
            userTypeClass = 'admin-user-ghost';
            userTypeLabel = '👻 Ghost User';
        } else if (isInactive) {
            userTypeClass = 'admin-user-inactive';
            userTypeLabel = '💤 Inactive User';
        }

        return (
            <div
                className={`admin-user-item ${userTypeClass}`}
                data-user-id={u.uid}
                key={u.uid}
            >
                <div className="admin-user-header">
                    <div className="admin-user-info">
                        <div className="admin-user-name">
                            {highlightMatch(displayName, adminSearchTerm)}
                            {userTypeLabel && (
                                <span className="user-type-label">
                                    {userTypeLabel}
                                </span>
                            )}
                            {!isInactive && !isGhost && !hasName && (
                                <span className="no-name-indicator">
                                    (No name set)
                                </span>
                            )}
                        </div>
                        <div className="admin-user-email">
                            {highlightMatch(u.email, adminSearchTerm)}
                            {u.emailAlumni && (
                                <>
                                    <br />
                                    <span style={{ fontSize: '0.85em', color: '#666' }}>
                                        Alumni: {u.emailAlumni}
                                    </span>
                                </>
                            )}
                            {u.emailAlumniGSB && (
                                <>
                                    <br />
                                    <span style={{ fontSize: '0.85em', color: '#666' }}>
                                        GSB: {u.emailAlumniGSB}
                                    </span>
                                </>
                            )}
                        </div>
                        <div className="admin-user-stats">
                            {actualCrushCount} crushing • {u.matches?.length || 0} matches • {u.crushes?.length || 0} selected
                            {!isInactive && !isGhost && actualCrushCount !== crushers.length && (
                                <span className="discrepancy-indicator">
                                    (calc: {crushers.length})
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => handleViewUserWithScrollPreservation(u.uid)}
                        className="admin-view-btn"
                        disabled={isGhost}
                    >
                        {isGhost ? 'Ghost' : (isViewing ? 'Collapse' : 'View')}
                    </button>
                </div>

                {isViewing && !isGhost && (
                    <div className="admin-user-expanded">
                        <div className="admin-view-header">
                            <h4>Data for {displayName} ({classDisplayName}):</h4>
                            {isInactive && (
                                <div style={{
                                    background: '#fff3cd',
                                    color: '#856404',
                                    padding: '8px 12px',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    marginTop: '8px'
                                }}>
                                    💤 This is an inactive user - they haven't signed up yet but are receiving crushes
                                </div>
                            )}
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
                                            <div key={idx} className="admin-name-item admin-match-with-timestamp">
                                                <div className="admin-match-name">{match.name}</div>
                                                <div className="admin-match-timestamp">
                                                    {formatAdminMatchTimestamp(match.matchedAt)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {isInactive && (
                                    <div style={{
                                        fontSize: '11px',
                                        color: '#666',
                                        fontStyle: 'italic',
                                        marginTop: '8px'
                                    }}>
                                        Inactive users cannot have matches until they sign up
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
                                {isInactive && (
                                    <div style={{
                                        fontSize: '11px',
                                        color: '#666',
                                        fontStyle: 'italic',
                                        marginTop: '8px'
                                    }}>
                                        Inactive users cannot send crushes until they sign up
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Account Unlinking Section */}
                        {canUnlink && (
                            <div style={{
                                marginTop: '20px',
                                padding: '12px',
                                background: '#fff3cd',
                                borderRadius: '4px',
                                border: '1px solid #ffc107'
                            }}>
                                <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>
                                    Account Unlinking
                                </div>
                                <div style={{ fontSize: '12px', color: '#856404', marginBottom: '10px' }}>
                                    {hasAlumniEmails && (
                                        <>This user has linked alumni emails. Unlinking will clear emailAlumni and emailAlumniGSB fields.</>
                                    )}
                                    {!hasAlumniEmails && !hasStanfordEmail && u.uid && (
                                        <>This user claimed a name with an alumni email. Unlinking will remove the UID claim and email.</>
                                    )}
                                </div>
                                {unlinkingUserId === u.uid ? (
                                    <div>
                                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#721c24', marginBottom: '10px' }}>
                                            Are you sure you want to unlink this account?
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                onClick={() => handleUnlinkAccount(u.uid, u)}
                                                disabled={unlinkingInProgress}
                                                style={{
                                                    padding: '6px 12px',
                                                    background: '#dc3545',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    fontSize: '12px',
                                                    cursor: unlinkingInProgress ? 'not-allowed' : 'pointer',
                                                    opacity: unlinkingInProgress ? 0.6 : 1
                                                }}
                                            >
                                                {unlinkingInProgress ? 'Unlinking...' : 'Yes, Unlink'}
                                            </button>
                                            <button
                                                onClick={() => setUnlinkingUserId(null)}
                                                disabled={unlinkingInProgress}
                                                style={{
                                                    padding: '6px 12px',
                                                    background: '#6c757d',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    fontSize: '12px',
                                                    cursor: unlinkingInProgress ? 'not-allowed' : 'pointer',
                                                    opacity: unlinkingInProgress ? 0.6 : 1
                                                }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setUnlinkingUserId(u.uid)}
                                        style={{
                                            padding: '6px 12px',
                                            background: '#dc3545',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Unlink Account
                                    </button>
                                )}
                            </div>
                        )}

                        {actualCrushCount === 0 && (!u.matches || u.matches.length === 0) && (!u.crushes || u.crushes.length === 0) && (
                            <div className="admin-no-activity">
                                No activity
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    });

    UserItem.displayName = 'UserItem';

    return (
        <div className="admin-users">
            {/* Success/Error Messages */}
            {unlinkSuccess && (
                <div style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    background: '#28a745',
                    color: 'white',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    zIndex: 1000,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    fontSize: '14px'
                }}>
                    {unlinkSuccess}
                </div>
            )}
            {unlinkError && (
                <div style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    background: '#dc3545',
                    color: 'white',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    zIndex: 1000,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    fontSize: '14px'
                }}>
                    {unlinkError}
                </div>
            )}

            <div className="admin-class-users-header">
                <h4>{classDisplayName} Users Management</h4>
                <div className="admin-class-users-summary">
                    <span>Active: {userStats.activeUsers}</span>
                    <span>Inactive: {userStats.inactiveUsers}</span>
                    <span>Ghost: {userStats.ghostUsers}</span>
                    <span>Total: {userStats.total}</span>
                </div>
            </div>

            <div className="admin-controls">
                <div className="admin-search-section">
                    <div className="admin-search-input-container">
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder={`Search ${classDisplayName} users by name or email...`}
                            value={adminSearchTerm}
                            onChange={handleAdminSearchChange}
                            className="admin-search-input"
                        />
                        {adminSearchTerm && (
                            <button
                                onClick={clearAdminSearch}
                                className="admin-search-clear-btn"
                                type="button"
                                aria-label="Clear search"
                            >
                                ×
                            </button>
                        )}
                    </div>
                    {adminSearchTerm && filteredUsers.length > 0 && (
                        <div className="admin-search-hint">
                            💡 {filteredUsers.length} results found. Try "first last" for best results.
                        </div>
                    )}
                    {filteredUsers.length > 50 && (
                        <div className="admin-pagination-info">
                            Showing all {filteredUsers.length} {classDisplayName} users
                        </div>
                    )}
                </div>
                <div className="admin-filter-section">
                    <select
                        value={userFilter}
                        onChange={(e) => setUserFilter(e.target.value as UserFilter)}
                        className="admin-filter-dropdown"
                    >
                        <option value="all">All {classDisplayName} Users ({userStats.total})</option>
                        <option value="active">Active Users ({userStats.activeUsers})</option>
                        <option value="inactive">Inactive Users ({userStats.inactiveUsers})</option>
                        <option value="ghost">Ghost Users ({userStats.ghostUsers})</option>
                    </select>
                </div>
            </div>

            {loadingUsers ? (
                <div className="loading">Loading {classDisplayName} users...</div>
            ) : (
                <div
                    ref={containerRef}
                    className="admin-users-container"
                    style={{ scrollBehavior: 'auto' }}
                >
                    {filteredUsers.map((u) => (
                        <UserItem key={u.uid} u={u} />
                    ))}

                    {filteredUsers.length === 0 && (
                        <div className="no-results">
                            {adminSearchTerm ? (
                                <>
                                    No {classDisplayName} users found matching "{adminSearchTerm}".
                                    <br />
                                    <small>Try searching with first and last name (e.g., "john smith")</small>
                                    <button onClick={clearAdminSearch} className="admin-clear-search-link">
                                        Clear search
                                    </button>
                                </>
                            ) : (
                                `No ${classDisplayName.toLowerCase()} users found.`
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminUsers;