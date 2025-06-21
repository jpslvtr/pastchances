import React, { useState, useMemo, useCallback } from 'react';
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

// Enhanced admin search matching function
const matchesAdminSearchTerm = (user: UserData | InactiveUser | GhostUser, searchTerm: string): { matches: boolean; score: number } => {
    if (!searchTerm.trim()) return { matches: true, score: 0 };

    const normalizeText = (text: string) => text.toLowerCase().trim().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ');

    const normalizedSearch = normalizeText(searchTerm);
    const searchParts = normalizedSearch.split(' ').filter(Boolean);

    // Search in name and email
    const searchableFields = [
        user.name || '',
        user.email || ''
    ].filter(Boolean);

    let bestScore = 0;
    let hasMatch = false;

    for (const field of searchableFields) {
        const normalizedField = normalizeText(field);

        // Simple substring match (highest priority)
        if (normalizedField.includes(normalizedSearch)) {
            hasMatch = true;
            bestScore = Math.max(bestScore, 100);
            continue;
        }

        const fieldParts = normalizedField.split(' ').filter(Boolean);

        // Check if all search parts match the beginning of field parts
        if (searchParts.every(searchPart =>
            fieldParts.some(fieldPart => fieldPart.startsWith(searchPart))
        )) {
            hasMatch = true;
            bestScore = Math.max(bestScore, 90);
            continue;
        }

        // Check if search parts match field parts in order (allows for middle names/domains)
        let fieldIndex = 0;
        let matchedParts = 0;

        for (const searchPart of searchParts) {
            let found = false;
            for (let i = fieldIndex; i < fieldParts.length; i++) {
                if (fieldParts[i].startsWith(searchPart)) {
                    matchedParts++;
                    fieldIndex = i + 1;
                    found = true;
                    break;
                }
            }
            if (!found) break;
        }

        if (matchedParts === searchParts.length) {
            hasMatch = true;
            bestScore = Math.max(bestScore, 80);
            continue;
        }

        // Fuzzy matching - check if most characters match
        const searchChars = normalizedSearch.replace(/\s/g, '');
        const fieldChars = normalizedField.replace(/\s/g, '');

        let matchCount = 0;
        let searchIndex = 0;

        for (let i = 0; i < fieldChars.length && searchIndex < searchChars.length; i++) {
            if (fieldChars[i] === searchChars[searchIndex]) {
                matchCount++;
                searchIndex++;
            }
        }

        const fuzzyScore = searchChars.length > 0 ? (matchCount / searchChars.length) * 100 : 0;

        if (fuzzyScore >= 70) {
            hasMatch = true;
            bestScore = Math.max(bestScore, fuzzyScore);
        }
    }

    return { matches: hasMatch, score: bestScore };
};

// Highlight matching parts for admin search
const highlightAdminMatch = (text: string, searchTerm: string) => {
    if (!searchTerm.trim() || !text) return text;

    const normalizeText = (str: string) => str.toLowerCase().trim();
    const normalizedText = normalizeText(text);
    const normalizedSearch = normalizeText(searchTerm);

    // Simple highlighting for exact substring matches
    const index = normalizedText.indexOf(normalizedSearch);
    if (index !== -1) {
        const before = text.substring(0, index);
        const match = text.substring(index, index + searchTerm.length);
        const after = text.substring(index + searchTerm.length);

        return (
            <>
                {before}
                <span className="admin-search-highlight">{match}</span>
                {after}
            </>
        );
    }

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
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const searchInputRef = React.useRef<HTMLInputElement>(null);

    const ITEMS_PER_PAGE = 50;

    // Debounce search term for better performance
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(adminSearchTerm);
            setVirtualStart(0); // Reset virtual scroll when search changes
        }, 300);

        return () => clearTimeout(timer);
    }, [adminSearchTerm]);

    const handleAdminSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setAdminSearchTerm(e.target.value);
    }, [setAdminSearchTerm]);

    // Clear search function
    const clearAdminSearch = useCallback(() => {
        setAdminSearchTerm('');
        setDebouncedSearchTerm('');
        setVirtualStart(0);
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [setAdminSearchTerm]);

    // Enhanced filtering with fuzzy matching
    const filteredUsers = useMemo(() => {
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

        // Apply search filter with fuzzy matching
        if (!debouncedSearchTerm.trim()) return users;

        const matchedUsers = users
            .map(user => {
                const result = matchesAdminSearchTerm(user, debouncedSearchTerm);
                return { user, ...result };
            })
            .filter(item => item.matches)
            .sort((a, b) => b.score - a.score)
            .map(item => item.user);

        return matchedUsers;
    }, [allUsers, debouncedSearchTerm, userFilter]);

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
                            {highlightAdminMatch(displayName, debouncedSearchTerm)}
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
                            {highlightAdminMatch(u.email, debouncedSearchTerm)}
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
                    {debouncedSearchTerm && debouncedSearchTerm !== adminSearchTerm && (
                        <div className="admin-search-loading">Searching...</div>
                    )}
                    {debouncedSearchTerm && filteredUsers.length > 0 && (
                        <div className="admin-search-hint">
                            💡 Results sorted by relevance. Search works with partial names and emails.
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
                            {debouncedSearchTerm ? (
                                <>
                                    No {classDisplayName} users found matching "{debouncedSearchTerm}".
                                    <br />
                                    <small>Try searching with partial names or email addresses</small>
                                    <button onClick={clearAdminSearch} className="admin-clear-search-link">
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