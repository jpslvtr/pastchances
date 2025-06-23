import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import AdminAnalytics from './admin/AdminAnalytics';
import AdminUsers from './admin/AdminUsers';
import { useAdminData } from '../hooks/useAdminData';
import { useAdminUtils } from '../hooks/useAdminUtils';
import type { UserData, UserClass } from '../types/userTypes';

type ViewMode = 'analytics' | 'users';
type UserFilter = 'all' | 'active' | 'inactive' | 'ghost';

interface AdminViewProps {
    user: any;
    userData: UserData | null;
}

const AdminView: React.FC<AdminViewProps> = ({ user, userData }) => {
    // Server-side admin check with error handling
    const [adminAccessDenied, setAdminAccessDenied] = useState(false);
    const [adminSearchTerm, setAdminSearchTerm] = useState('');
    const [viewingUserId, setViewingUserId] = useState<string | null>(null);
    const [userFilter, setUserFilter] = useState<UserFilter>('all');
    const [viewMode, setViewMode] = useState<ViewMode>('analytics');
    const [refreshKey, setRefreshKey] = useState(0);

    // Automatically determine which class view to show based on current user's class
    const currentClassView: UserClass = userData?.userClass || 'gsb';
    const classDisplayName = currentClassView === 'gsb' ? 'GSB MBA' : 'Undergraduate';

    // Use custom hooks
    const {
        allUsers,
        loadingUsers,
        currentAnalytics,
        loadingAnalytics,
        loadAllUsers
    } = useAdminData(user, currentClassView, refreshKey);

    const { findCrushersForUser } = useAdminUtils(allUsers || []);

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
                console.log('Live analytics updated');
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

    // Get current class stats with proper null checks
    const currentClassStats = useMemo(() => {
        // Add null/undefined checks for allUsers
        if (!allUsers || !Array.isArray(allUsers)) {
            return {
                activeUsers: 0,
                inactiveUsers: 0,
                ghostUsers: 0,
                total: 0
            };
        }

        const realUsers = allUsers.filter(u => !(u as any).isInactive && !(u as any).isGhost);
        const inactiveUsers = allUsers.filter(u => (u as any).isInactive);
        const ghostUsers = allUsers.filter(u => (u as any).isGhost);

        return {
            activeUsers: realUsers.length,
            inactiveUsers: inactiveUsers.length,
            ghostUsers: ghostUsers.length,
            total: allUsers.length
        };
    }, [allUsers]);

    const handleViewUser = useCallback((userId: string) => {
        setViewingUserId(viewingUserId === userId ? null : userId);
    }, [viewingUserId]);

    const handleRefresh = useCallback(async () => {
        setRefreshKey(prev => prev + 1);
        await loadAllUsers();
    }, [loadAllUsers]);

    // Show loading state if allUsers is not yet loaded
    if (!allUsers && loadingUsers) {
        return (
            <div className="admin-loading">
                Loading {classDisplayName} admin data...
            </div>
        );
    }

    return (
        <div className="admin-section">
            <div className="admin-header-section">
                <div className="admin-title-row">
                    <h3>{classDisplayName} Admin Dashboard</h3>
                    <button onClick={handleRefresh} className="admin-refresh-btn" disabled={loadingUsers || loadingAnalytics}>
                        {loadingUsers || loadingAnalytics ? '↻ Loading...' : '↻ Refresh'}
                    </button>
                </div>

                <div className="admin-definitions">
                    <p><strong>Current View:</strong> You are viewing data for the {classDisplayName} class only. Switch to a different class account to view other class data.</p>
                    <p><strong>Active Users:</strong> {classDisplayName} students who have signed up and can match within their class.</p>
                    <p><strong>Inactive Users:</strong> {classDisplayName} students from the class roster who haven't signed up yet but are receiving crushes.</p>
                    <p><strong>Ghost Users:</strong> {classDisplayName} students from the class roster with zero engagement.</p>
                </div>
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
                        classView={currentClassView}
                        classDisplayName={classDisplayName}
                        allUsers={allUsers || []}
                    />
                )}
                {viewMode === 'users' && (
                    <AdminUsers
                        allUsers={allUsers || []}
                        loadingUsers={loadingUsers}
                        adminSearchTerm={adminSearchTerm}
                        setAdminSearchTerm={setAdminSearchTerm}
                        userFilter={userFilter}
                        setUserFilter={setUserFilter}
                        viewingUserId={viewingUserId}
                        handleViewUser={handleViewUser}
                        findCrushersForUser={findCrushersForUser}
                        userStats={currentClassStats}
                        classView={currentClassView}
                        classDisplayName={classDisplayName}
                    />
                )}
            </div>
        </div>
    );
};

export default AdminView;