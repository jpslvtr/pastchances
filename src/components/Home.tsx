import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import AdminView from './AdminView';
import UserDashboard from './UserDashboard';
import Navbar from './shared/Navbar';
import { getUserDocumentId } from '../utils';
import { isAdminUser } from '../utils/adminUtils';
import { EngagementStats } from './dashboard/EngagementStats';

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
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isAdmin = isAdminUser(user, userData);
    const hasUnsavedChanges = JSON.stringify([...selectedNames].sort()) !== JSON.stringify([...savedNames].sort());

    useEffect(() => {
        return () => {
            if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
        };
    }, []);

    // Warn before closing/refreshing the tab with unsaved selections
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);


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
            if (currentNames.includes(name)) {
                return currentNames.filter(n => n !== name);
            }

            // Add new name at the top, but after locked crushes
            const lockedCrushes = userData?.lockedCrushes || [];
            const locked = currentNames.filter(n => lockedCrushes.includes(n));
            const unlocked = currentNames.filter(n => !lockedCrushes.includes(n));

            return [...locked, name, ...unlocked];
        });
    }, [updating, userData?.lockedCrushes]);

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
            const previousCrushes = userData.crushes || [];

            // Optimistic update
            setSelectedNames(finalCrushes);
            setSavedNames(finalCrushes);
            updateUserDataOptimistically({ crushes: finalCrushes });

            // Show success immediately (optimistic)
            if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
            setSuccessMessage('Preferences updated successfully!');
            successTimeoutRef.current = setTimeout(() => setSuccessMessage(null), 3000);

            // Fire and forget — revert everything on failure
            updateDoc(userRef, {
                crushes: finalCrushes,
                updatedAt: serverTimestamp()
            }).catch(error => {
                console.error('Error updating preferences:', error);
                setSelectedNames(previousCrushes);
                setSavedNames(previousCrushes);
                updateUserDataOptimistically({ crushes: previousCrushes });
                if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
                setSuccessMessage(null);
                setError('Failed to update preferences. Please try again.');
            });

        } catch (error) {
            console.error('Error updating preferences:', error);
            setError('Failed to update preferences. Please try again.');
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
        <>
        {successMessage && (
            <div style={{
                position: 'fixed',
                top: 'max(20px, env(safe-area-inset-top))',
                right: '20px',
                background: '#28a745',
                color: 'white',
                padding: '12px 20px',
                borderRadius: '8px',
                zIndex: 1000,
                fontWeight: 500,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                pointerEvents: 'none'
            }}>
                {successMessage}
            </div>
        )}
        <div className="dashboard-container">
            <div className="dashboard-card">
                <Navbar
                    user={user}
                    userData={userData}
                    isAdminMode={isAdminMode}
                    onAdminToggle={handleAdminToggle}
                />

                <div className="dashboard-content">
                    {!isAdminMode && <EngagementStats />}

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
        </>
    );
};

export default Home;