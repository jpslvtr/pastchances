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
    const [searchDebounce, setSearchDebounce] = useState('');

    const ITEMS_PER_PAGE = 50;

    const handleAdminSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchDebounce(value);

        setTimeout(() => {
            setAdminSearchTerm(value);
        }, 300);
    }, [setAdminSearchTerm]);

    const visibleUsers = useMemo(() => {
        const startIndex = virtualStart;
        const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, allUsers.length);
        return allUsers.slice(startIndex, endIndex);
    }, [allUsers, virtualStart]);

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
                            {displayName}
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
                        <div className="admin-user-email">{u.email}</div>
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
                    <input
                        type="text"
                        placeholder={`Search ${classDisplayName} users...`}
                        value={searchDebounce}
                        onChange={handleAdminSearchChange}
                        className="admin-search-input"
                    />
                    {allUsers.length > ITEMS_PER_PAGE && (
                        <div className="admin-pagination-info">
                            Showing {Math.min(visibleUsers.length, ITEMS_PER_PAGE)} of {allUsers.length} {classDisplayName} users
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

                    {virtualStart + ITEMS_PER_PAGE < allUsers.length && (
                        <div style={{ height: `${(allUsers.length - virtualStart - ITEMS_PER_PAGE) * 80}px` }} className="virtual-spacer" />
                    )}

                    {allUsers.length === 0 && (
                        <div className="no-results">
                            {adminSearchTerm ? `No ${classDisplayName} users found.` : `No ${classDisplayName} users available.`}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminUsers;