import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { GSB_CLASS_NAMES } from '../data/names';

const Home: React.FC = () => {
    const { user, userData, logout, refreshUserData } = useAuth();
    const [imageError, setImageError] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedNames, setSelectedNames] = useState<string[]>([]);
    const [savedNames, setSavedNames] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadUserSelections = useCallback(async () => {
        if (!user) return;

        try {
            const userRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.crushes && Array.isArray(userData.crushes)) {
                    setSelectedNames(userData.crushes);
                    setSavedNames(userData.crushes);
                }
            }
        } catch (error) {
            console.error('Error loading user selections:', error);
            setError('Failed to load your previous selections.');
        }
    }, [user]);

    useEffect(() => {
        let isMounted = true;

        const loadData = async () => {
            try {
                setError(null);

                if (isMounted && user) {
                    await loadUserSelections();
                }
            } catch (error) {
                console.error('Error loading data:', error);
                if (isMounted) {
                    setError('Failed to load your data. Please refresh the page.');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        loadData();

        return () => {
            isMounted = false;
        };
    }, [user, loadUserSelections]);

    const filteredAvailableNames = useMemo(() => {
        const excludedNames = [...selectedNames];

        if (userData?.verifiedName) {
            excludedNames.push(userData.verifiedName);
        }

        const availableNames = GSB_CLASS_NAMES.filter(name => !excludedNames.includes(name));

        if (!searchTerm) return availableNames;

        return availableNames.filter(name =>
            name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [selectedNames, searchTerm, userData?.verifiedName]);

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

        // Check if this name is locked (user has matched with this person)
        const lockedCrushes = userData?.lockedCrushes || [];
        if (lockedCrushes.includes(nameToRemove)) {
            // Silently prevent removal - don't show alert
            return;
        }

        setSelectedNames(prev => prev.filter(name => name !== nameToRemove));
    }, [updating, userData?.lockedCrushes]);

    const handleUpdatePreferences = useCallback(async () => {
        if (!user || updating) return;

        // Validate that locked crushes are still present
        const lockedCrushes = userData?.lockedCrushes || [];
        const missingLockedCrushes = lockedCrushes.filter(locked => !selectedNames.includes(locked));

        if (missingLockedCrushes.length > 0) {
            // Add back the missing locked crushes silently
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

            // Show success message briefly
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

    const hasMatches = userData?.matches && userData.matches.length > 0;
    const crushCount = userData?.crushCount || 0;
    const lockedCrushes = userData?.lockedCrushes || [];
    const hasUnsavedChanges = JSON.stringify(selectedNames.sort()) !== JSON.stringify(savedNames.sort());

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
                        <button className="logout-btn" onClick={logout}>Logout</button>
                    </div>
                </div>

                <div className="dashboard-content">
                    {crushCount > 0 && (
                        <div className="crush-count-section">
                            <h2>{crushCount} {crushCount === 1 ? 'person is' : 'people are'} crushing on you!</h2>
                        </div>
                    )}

                    {hasMatches && (
                        <div className="matches-section">
                            <h2>🎉 You have {userData.matches.length} match{userData.matches.length > 1 ? 'es' : ''}!</h2>
                            <div className="matches-list">
                                {userData.matches.map((match, index) => (
                                    <div key={index} className="match-item">
                                        <div className="match-name">{match.name}</div>
                                        <div className="match-email">{match.email}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="header-section">
                        <div className="instructions">
                            <ol>
                                <li>Select any classmates you'd like to connect with. Your selections are completely private - only you can see who you've chosen.</li>
                                <li>Click "Update Preferences" to save your changes. Matches appear automatically when someone you've selected also selects you. Matches are completely private.</li>
                                <li>You can add or remove names anytime. There's no limit on how many people you can select, and you can change your preferences as often as you want.</li>
                                <li><strong>Important:</strong> Once you match with someone, you cannot remove them from your list. This prevents gaming the system.</li>
                            </ol>
                        </div>
                    </div>

                    <div className="selection-counter">
                        {selectedNames.length} selected
                        {hasUnsavedChanges && <span className="unsaved-badge">UNSAVED CHANGES</span>}
                    </div>

                    {selectedNames.length > 0 && (
                        <div className="selected-names">
                            <h3>Your Selections ({selectedNames.length})</h3>
                            <div className="name-chips">
                                {selectedNames.map(name => {
                                    const isLocked = lockedCrushes.includes(name);
                                    return (
                                        <div key={name} className={`name-chip ${isLocked ? 'locked' : 'selected'}`}>
                                            <span>{name}</span>
                                            {isLocked ? (
                                                <span className="lock-icon" title="Locked - you have matched with this person">🔒</span>
                                            ) : (
                                                <button
                                                    onClick={() => handleRemoveSelected(name)}
                                                    className="remove-btn"
                                                    aria-label={`Remove ${name}`}
                                                    disabled={updating}
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="search-section">
                        <input
                            type="text"
                            placeholder="Search names..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>

                    <div className="available-names">
                        <h3>
                            Available Classmates
                            {searchTerm && ` (${filteredAvailableNames.length} found)`}
                        </h3>
                        <div className="names-simple-list">
                            {filteredAvailableNames.map(name => (
                                <div
                                    key={name}
                                    onClick={() => !updating && handleNameToggle(name)}
                                    className={`name-list-item ${updating ? 'disabled' : ''}`}
                                >
                                    <span className="name-text">{name}</span>
                                    <span className="add-btn">+</span>
                                </div>
                            ))}
                            {filteredAvailableNames.length === 0 && (
                                <div className="no-results">
                                    {searchTerm ? 'No names found matching your search.' : 'All classmates have been selected!'}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="action-section">
                        <div className="action-buttons">
                            <button
                                onClick={handleUpdatePreferences}
                                disabled={updating || !hasUnsavedChanges}
                                className="update-btn"
                            >
                                {updating ? 'Updating...' : 'Update Preferences'}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="error-message" style={{ color: 'red', textAlign: 'center', marginTop: '15px' }}>
                            {error}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Home;