import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { UserData, MatchInfo, UserClass } from '../../types/userTypes';

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
}

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
    classDisplayName
}) => {
    const [virtualStart, setVirtualStart] = useState(0);
    const searchInputRef = React.useRef<HTMLInputElement>(null);

    const ITEMS_PER_PAGE = 50;

    // Reset virtual scroll when search term or filter changes
    useEffect(() => {
        setVirtualStart(0);
    }, [adminSearchTerm, userFilter]);

    const handleAdminSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setAdminSearchTerm(newValue);
        setVirtualStart(0);
    }, [setAdminSearchTerm]);

    // Clear search function
    const clearAdminSearch = useCallback(() => {
        setAdminSearchTerm('');
        setVirtualStart(0);
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [setAdminSearchTerm]);

    // Use the exact same filtering logic as normal search with better debugging
    const filteredUsers = useMemo(() => {
        console.log('Admin filtering - Search term:', `"${adminSearchTerm}"`, 'Filter:', userFilter, 'All users count:', allUsers.length);

        let users = allUsers;

        // Apply user type filter first
        switch (userFilter) {
            case 'active':
                users = users.filter(u =>
                    !(u as InactiveUser).isInactive && !(u as GhostUser).isGhost
                );
                break;
            case 'inactive':
                users = users.filter(u => (u as InactiveUser).isInactive);
                break;
            case 'ghost':
                users = users.filter(u => (u as GhostUser).isGhost);
                break;
            case 'all':
            default:
                break;
        }

        console.log('After filter:', users.length, 'users');

        // Apply search filter - key fix: explicit empty string check
        const trimmedSearch = adminSearchTerm.trim();
        if (trimmedSearch === '') {
            console.log('Empty search, returning all filtered users');
            return users;
        }

        console.log('Applying search for:', `"${trimmedSearch}"`);

        const matchedUsers = users
            .map(user => {
                // Search in both name and email
                const searchableTexts = [
                    user.name || '',
                    user.email || ''
                ].filter(Boolean);

                let bestMatch = { matches: false, score: 0 };

                // Test each searchable text and take the best match
                for (const text of searchableTexts) {
                    const result = matchesSearchTerm(text, trimmedSearch);
                    if (result.matches && result.score > bestMatch.score) {
                        bestMatch = result;
                    }
                }

                return { user, ...bestMatch };
            })
            .filter(item => item.matches)
            .sort((a, b) => b.score - a.score)
            .map(item => item.user);

        console.log('Search results:', matchedUsers.length, 'users');
        return matchedUsers;
    }, [allUsers, adminSearchTerm, userFilter]);

    const visibleUsers = useMemo(() => {
        const startIndex = virtualStart;
        const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredUsers.length);
        return filteredUsers.slice(startIndex, endIndex);
    }, [filteredUsers, virtualStart]);

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const target = e.target as HTMLDivElement;
        const scrollTop = target.scrollTop;
        const itemHeight = 80;
        const newStart = Math.floor(scrollTop / itemHeight);

        if (Math.abs(newStart - virtualStart) > 5) {
            setVirtualStart(Math.max(0, newStart - 10));
        }
    }, [virtualStart]);

    const UserItem = React.memo(({ u }: { u: UserData | InactiveUser | GhostUser }) => {
        const isViewing = viewingUserId === u.uid;
        const actualCrushCount = u.crushCount || 0;
        const crushers = findCrushersForUser(u);
        const isInactive = (u as InactiveUser).isInactive || false;
        const isGhost = (u as GhostUser).isGhost || false;

        const displayName = u.name || u.email;
        const hasName = !!(u.name && u.name.trim());

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
            <div className={`admin-user-item ${userTypeClass}`}>
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
                        onClick={() => handleViewUser(u.uid)}
                        className="admin-view-btn"
                        disabled={isInactive || isGhost}
                    >
                        {isGhost ? 'Ghost' : (isInactive ? 'Inactive' : (isViewing ? 'Collapse' : 'View'))}
                    </button>
                </div>

                {isViewing && !isInactive && !isGhost && (
                    <div className="admin-user-expanded">
                        <div className="admin-view-header">
                            <h4>Data for {displayName} ({classDisplayName}):</h4>
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
                    {filteredUsers.length > ITEMS_PER_PAGE && (
                        <div className="admin-pagination-info">
                            Showing {Math.min(visibleUsers.length, ITEMS_PER_PAGE)} of {filteredUsers.length} {classDisplayName} users
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
                    className="admin-users-container"
                    onScroll={handleScroll}
                >
                    {virtualStart > 0 && (
                        <div style={{ height: `${virtualStart * 80}px` }} className="virtual-spacer" />
                    )}

                    {visibleUsers.map((u) => (
                        <UserItem key={u.uid} u={u} />
                    ))}

                    {virtualStart + ITEMS_PER_PAGE < filteredUsers.length && (
                        <div style={{ height: `${(filteredUsers.length - virtualStart - ITEMS_PER_PAGE) * 80}px` }} className="virtual-spacer" />
                    )}

                    {filteredUsers.length === 0 && (
                        <div className="no-results">
                            {adminSearchTerm ? (
                                <>
                                    No {classDisplayName} users found matching "{adminSearchTerm}".
                                    <br />
                                    <small>Try searching with first and last name (e.g., "john smith")</small>
                                    <button onClick={clearAdminSearch} className="clear-search-link">
                                        Clear search
                                    </button>
                                </>
                            ) : (
                                `No ${classDisplayName} users available.`
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminUsers;