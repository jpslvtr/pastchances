import React from 'react';

interface MatchInfo {
    name: string;
    email: string;
}

interface UserData {
    uid: string;
    email: string;
    name: string;
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

type UserFilter = 'all' | 'active' | 'inactive';

interface AdminUsersProps {
    allUsers: (UserData | InactiveUser)[];
    loadingUsers: boolean;
    adminSearchTerm: string;
    setAdminSearchTerm: (term: string) => void;
    userFilter: UserFilter;
    setUserFilter: (filter: UserFilter) => void;
    viewingUserId: string | null;
    handleViewUser: (userId: string) => void;
    findCrushersForUser: (user: UserData | InactiveUser) => CrusherInfo[];
    userStats: {
        realUsers: number;
        inactiveUsers: number;
        total: number;
    };
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
    userStats
}) => {
    const handleAdminSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAdminSearchTerm(e.target.value);
    };

    return (
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
                        <option value="inactive">Inactive Users ({userStats.inactiveUsers})</option>
                    </select>
                </div>
            </div>

            {loadingUsers ? (
                <div className="loading">Loading users...</div>
            ) : (
                <div className="admin-users-container">
                    {allUsers.map(u => {
                        const isViewing = viewingUserId === u.uid;
                        const actualCrushCount = u.crushCount || 0;
                        const crushers = findCrushersForUser(u);
                        const isInactive = (u as InactiveUser).isInactive || false;

                        const displayName = u.name || u.email;
                        const hasName = !!(u.name && u.name.trim());

                        return (
                            <div key={u.uid} className={`admin-user-item ${isInactive ? 'admin-user-inactive' : ''}`}>
                                <div className="admin-user-header">
                                    <div className="admin-user-info">
                                        <div className="admin-user-name">
                                            {displayName}
                                            {isInactive && (
                                                <span style={{ color: '#6c757d', marginLeft: '8px', fontSize: '11px' }}>
                                                    💤 Inactive User
                                                </span>
                                            )}
                                            {!isInactive && !hasName && (
                                                <span style={{ color: '#dc3545', marginLeft: '8px', fontSize: '11px' }}>
                                                    (No name set)
                                                </span>
                                            )}
                                        </div>
                                        <div className="admin-user-email">{u.email}</div>
                                        <div className="admin-user-stats">
                                            {actualCrushCount} crushing • {u.matches?.length || 0} matches • {u.crushes?.length || 0} selected
                                            {!isInactive && actualCrushCount !== crushers.length && (
                                                <span style={{ color: '#dc3545', marginLeft: '8px' }}>
                                                    (calc: {crushers.length})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleViewUser(u.uid)}
                                        className="admin-view-btn"
                                        disabled={isInactive}
                                    >
                                        {isInactive ? 'Inactive' : (isViewing ? 'Collapse' : 'View')}
                                    </button>
                                </div>

                                {isViewing && !isInactive && (
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
                    })}
                    {allUsers.length === 0 && (
                        <div className="no-results">
                            {adminSearchTerm ? 'No users found.' : 'No users available.'}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminUsers;