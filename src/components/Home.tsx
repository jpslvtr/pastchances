import React, { useState, useEffect, useCallback } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import AdminView from './AdminView';
import UserDashboard from './UserDashboard';

// Helper function to get the correct document ID for user class
function getUserDocumentId(user: any, userData: any): string {
    if (user?.email === 'jpark22@stanford.edu') {
        // For test user, use class-specific UIDs
        const userClass = userData?.userClass || 'gsb';
        return userClass === 'gsb' ? `${user.uid}_gsb` : `${user.uid}_undergrad`;
    }
    return user?.uid || '';
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
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [adminAccessError, setAdminAccessError] = useState(false);

    // Strict admin check - only jpark22@stanford.edu can access admin mode
    const isAdmin = user?.email === 'jpark22@stanford.edu';

    // Get the class display name based on user's class
    const getClassDisplayName = useCallback(() => {
        const userClass = userData?.userClass || 'gsb';
        return userClass === 'gsb' ? 'GSB MBA Class of 2025' : 'Undergrad Class of 2025';
    }, [userData?.userClass]);

    const loadUserSelections = useCallback(async () => {
        if (!user || !userData) return;

        try {
            const actualUid = getUserDocumentId(user, userData);
            const userRef = doc(db, 'users', actualUid);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
                const data = userDoc.data();
                const crushes = data.crushes && Array.isArray(data.crushes) ? data.crushes : [];
                setSelectedNames(crushes);
                setSavedNames(crushes);
            } else {
                setSelectedNames([]);
                setSavedNames([]);
            }
        } catch (error) {
            console.error('Error loading user selections:', error);
            setError('Failed to load your previous selections.');
            setSelectedNames([]);
            setSavedNames([]);
        }
    }, [user, userData]);

    useEffect(() => {
        const loadData = async () => {
            try {
                setError(null);
                setAdminAccessError(false);
                if (user && userData) {
                    await loadUserSelections();
                }
            } catch (error) {
                console.error('Error loading data:', error);
                setError('Failed to load your data. Please refresh the page.');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [user, userData, loadUserSelections]);

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

        setSelectedNames(prev => {
            const currentNames = prev || [];
            return currentNames.includes(name)
                ? currentNames.filter(n => n !== name)
                : [...currentNames, name];
        });
    }, [updating]);

    const handleRemoveSelected = useCallback((nameToRemove: string) => {
        if (updating) return;

        const lockedCrushes = userData?.lockedCrushes || [];
        if (lockedCrushes.includes(nameToRemove)) {
            return;
        }

        setSelectedNames(prev => (prev || []).filter(name => name !== nameToRemove));
    }, [updating, userData?.lockedCrushes]);

    const handleUpdatePreferences = useCallback(async () => {
        if (!user || !userData || updating) return;

        const lockedCrushes = userData?.lockedCrushes || [];
        const currentSelectedNames = selectedNames || [];
        const missingLockedCrushes = lockedCrushes.filter(locked => !currentSelectedNames.includes(locked));

        if (missingLockedCrushes.length > 0) {
            const restoredNames = [...new Set([...currentSelectedNames, ...lockedCrushes])];
            setSelectedNames(restoredNames);
        }

        setUpdating(true);
        setError(null);

        try {
            const actualUid = getUserDocumentId(user, userData);
            const userRef = doc(db, 'users', actualUid);
            const finalCrushes = [...new Set([...currentSelectedNames, ...lockedCrushes])];

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
    }, [user, userData, updating, selectedNames, refreshUserData]);

    // Enhanced admin mode toggle with proper error handling
    const handleAdminToggle = useCallback(() => {
        if (!isAdmin) {
            setAdminAccessError(true);
            setTimeout(() => setAdminAccessError(false), 3000);
            return;
        }
        setIsAdminMode(!isAdminMode);
    }, [isAdmin, isAdminMode]);

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

    return (
        <div className="dashboard-container">
            <div className="dashboard-card">
                <div className="dashboard-header">
                    <h1>Past Chances: {getClassDisplayName()}</h1>
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
                                <div className="user-name">{userData?.name || user?.displayName}</div>
                                <div className="user-email">{user?.email}</div>
                            </div>
                        </div>
                        <div className="header-actions">
                            {isAdmin && (
                                <button
                                    onClick={handleAdminToggle}
                                    className="admin-toggle-btn"
                                >
                                    {isAdminMode ? 'Exit Admin View' : 'Admin View'}
                                </button>
                            )}
                            <button className="logout-btn" onClick={logout}>Logout</button>
                        </div>
                    </div>
                </div>

                {adminAccessError && (
                    <div className="error-message" style={{
                        background: '#f8d7da',
                        color: '#721c24',
                        padding: '10px',
                        margin: '10px 20px',
                        borderRadius: '4px',
                        fontSize: '14px',
                        textAlign: 'center'
                    }}>
                        Access denied. Admin privileges are required.
                    </div>
                )}

                <div className="dashboard-content">
                    {isAdminMode && isAdmin ? (
                        <AdminView user={user} userData={userData} />
                    ) : (
                        <UserDashboard
                            userData={userData!}
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            selectedNames={selectedNames || []}
                            savedNames={savedNames || []}
                            updating={updating}
                            error={error}
                            handleNameToggle={handleNameToggle}
                            handleRemoveSelected={handleRemoveSelected}
                            handleUpdatePreferences={handleUpdatePreferences}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default Home;