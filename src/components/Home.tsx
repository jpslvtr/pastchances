import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AdminView from '../components/AdminView';
import UserDashboard from '../components/UserDashboard';
import { db } from '../config/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { isAdminUser } from '../utils/adminUtils';
import { getUserDocumentId } from '../utils';

const Home = () => {
    const { user, userData, signOut, refreshUserData } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());
    const [selectedNames, setSelectedNames] = useState<string[]>([]);
    const [savedNames, setSavedNames] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [adminAccessError, setAdminAccessError] = useState(false);

    const isAdmin = isAdminUser(user, userData);

    const getClassDisplayName = useCallback(() => {
        const userClass = userData?.userClass || 'gsb';
        return userClass === 'gsb' ? 'GSB MBA Class of 2025' : 'Undergrad Class of 2025';
    }, [userData?.userClass]);

    const loadUserSelections = useCallback(() => {
        if (!userData) return;

        const crushes = userData.crushes && Array.isArray(userData.crushes) ? userData.crushes : [];
        setSelectedNames(crushes);
        setSavedNames(crushes);
    }, [userData]);

    useEffect(() => {
        const loadData = async () => {
            try {
                setError(null);
                setAdminAccessError(false);
                if (user && userData) {
                    loadUserSelections();
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

    const handleImageError = useCallback((imageUrl: string) => {
        console.log('Image failed to load:', imageUrl);
        setFailedImageUrls(prev => new Set(prev).add(imageUrl));
    }, []);

    const getProfileImageUrl = useCallback(() => {
        const googlePhotoUrl = userData?.photoURL;
        const fallbackUrl = '/files/default-profile.png';

        if (!googlePhotoUrl) {
            return fallbackUrl;
        }

        if (failedImageUrls.has(googlePhotoUrl)) {
            return fallbackUrl;
        }

        return googlePhotoUrl;
    }, [userData?.photoURL, failedImageUrls]);

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

    const currentImageUrl = getProfileImageUrl();

    return (
        <div className="dashboard-container">
            <div className="dashboard-card">
                <div className="dashboard-header">
                    <div className="header-title">
                        <h1>Second Chances</h1>
                        <div className="header-subtitle">{getClassDisplayName()}</div>
                    </div>
                    <div className="user-info">
                        <div className="user-details">
                            <img
                                src={currentImageUrl}
                                alt="Profile"
                                className="profile-pic"
                                onError={() => handleImageError(currentImageUrl)}
                                loading="lazy"
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
                            <button className="logout-btn" onClick={signOut}>Logout</button>
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

                <div className="dashboard-footer">
                    <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                    <span className="footer-separator">•</span>
                    <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
                </div>
            </div>
        </div>
    );
};

export default Home;