import React, { useState, useEffect, useCallback } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import AdminView from './AdminView';
import UserDashboard from './UserDashboard';

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

    const isAdmin = user?.email === 'jpark22@stanford.edu';

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
                }
            } catch (error) {
                console.error('Error loading data:', error);
                setError('Failed to load your data. Please refresh the page.');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [user, loadUserSelections]);

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
                        <AdminView user={user} />
                    ) : (
                        <UserDashboard
                            userData={userData!}
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            selectedNames={selectedNames}
                            savedNames={savedNames}
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