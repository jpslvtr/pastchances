import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AdminView from '../components/AdminView';
import UserDashboard from '../components/UserDashboard';
import Navbar from '../components/shared/Navbar';
import { db } from '../config/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { isAdminUser } from '../utils/adminUtils';
import { getUserDocumentId } from '../utils';

const Home = () => {
    const { user, userData, updateUserDataOptimistically } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedNames, setSelectedNames] = useState<string[]>([]);
    const [savedNames, setSavedNames] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isAdminMode, setIsAdminMode] = useState(false);

    const isAdmin = isAdminUser(user, userData);

    // Check for admin query parameter on mount
    useEffect(() => {
        if (searchParams.get('admin') === 'true' && isAdmin) {
            setIsAdminMode(true);
            // Remove the query parameter from URL
            setSearchParams({});
        }
    }, [searchParams, setSearchParams, isAdmin]);

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
            const now = new Date();

            // Optimistic update - update all local state immediately
            setSelectedNames(finalCrushes);
            setSavedNames(finalCrushes);
            updateUserDataOptimistically({
                crushes: finalCrushes,
                updatedAt: now
            });

            // Show success message immediately
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

            // Fire and forget - update Firestore in background
            updateDoc(userRef, {
                crushes: finalCrushes,
                updatedAt: now
            }).catch(error => {
                console.error('Error updating preferences:', error);
                // Revert optimistic updates on error
                setSelectedNames(savedNames);
                setError('Failed to update preferences. Please try again.');
            });

        } catch (error) {
            console.error('Error updating preferences:', error);
            setError('Failed to update preferences. Please try again.');

            // Revert optimistic update on error
            setSelectedNames(savedNames);
        } finally {
            setUpdating(false);
        }
    }, [user, userData, updating, selectedNames, savedNames, updateUserDataOptimistically]);

    const handleAdminToggle = useCallback(() => {
        setIsAdminMode(prev => !prev);
    }, []);

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
                <Navbar
                    user={user}
                    userData={userData}
                    isAdminMode={isAdminMode}
                    onAdminToggle={handleAdminToggle}
                />

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