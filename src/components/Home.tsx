import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';

const Home: React.FC = () => {
    const { user, userData, logout, refreshUserData } = useAuth();
    const [imageError, setImageError] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedNames, setSelectedNames] = useState<string[]>([]);
    const [allNames, setAllNames] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [submitting, setSubmitting] = useState(false);
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
                }
            }
        } catch (error) {
            console.error('Error loading user selections:', error);
            setError('Failed to load your previous selections. Please refresh the page.');
        }
    }, [user]);

    useEffect(() => {
        let isMounted = true;

        const loadData = async () => {
            try {
                setError(null);

                const response = await fetch('/files/names.txt');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const text = await response.text();
                const names = text
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('Here\'s the list'))
                    .filter(line => line.length > 0);

                if (isMounted) {
                    setAllNames(names);

                    if (user) {
                        await loadUserSelections();
                    }
                }
            } catch (error) {
                console.error('Error loading names:', error);
                if (isMounted) {
                    setError('Failed to load class names. Please refresh the page.');
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

        const availableNames = allNames.filter(name => !excludedNames.includes(name));

        if (!searchTerm) return availableNames;

        return availableNames.filter(name =>
            name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [allNames, selectedNames, searchTerm, userData?.verifiedName]);

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
        if (userData?.submitted) return;

        setSelectedNames(prev => {
            if (prev.includes(name)) {
                return prev.filter(n => n !== name);
            } else if (prev.length < 10) {  // Changed from 25 to 10
                return [...prev, name];
            }
            return prev;
        });
    }, [userData?.submitted]);

    const handleSaveDraft = useCallback(async () => {
        if (!user || userData?.submitted || saving) return;

        setSaving(true);
        setError(null);

        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                crushes: selectedNames,
                updatedAt: new Date()
            });

            await refreshUserData();
            alert('Your draft has been saved!');
        } catch (error) {
            console.error('Error saving draft:', error);
            setError('Failed to save draft. Please try again.');
        } finally {
            setSaving(false);
        }
    }, [user, userData?.submitted, saving, selectedNames, refreshUserData]);

    const handleSubmitList = useCallback(async () => {
        if (!user || userData?.submitted || submitting) return;

        const confirmed = window.confirm(
            `Are you sure you want to submit your list? You will NOT be able to make changes after submission. You have ${selectedNames.length} names selected.`
        );

        if (!confirmed) return;

        setSubmitting(true);
        setError(null);

        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                crushes: selectedNames,
                submitted: true,
                updatedAt: new Date()
            });

            await refreshUserData();
            alert('Your list has been submitted! Check back for matches.');
        } catch (error) {
            console.error('Error submitting list:', error);
            setError('Failed to submit list. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }, [user, userData?.submitted, submitting, selectedNames, refreshUserData]);

    const handleRemoveSelected = useCallback((nameToRemove: string) => {
        if (userData?.submitted) return;

        setSelectedNames(prev => prev.filter(name => name !== nameToRemove));
    }, [userData?.submitted]);

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

    const isSubmitted = userData?.submitted || false;
    const hasMatches = userData?.matches && userData.matches.length > 0;

    return (
        <div className="dashboard-container">
            <div className="dashboard-card">
                <div className="dashboard-header">
                    <h1>GSB Class of 2025</h1>
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
                    {isSubmitted && hasMatches && (
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
                        {isSubmitted ? (
                            <div className="submitted-notice">
                                Your list has been submitted and can no longer be edited.
                                {!hasMatches && <div className="no-matches">No matches yet - check back later!</div>}
                            </div>
                        ) : (
                            <p>Select up to 10 classmates you'd like to "connect" with. Your selections are kept private and only visible to you unless there's a mutual match.</p>
                        )}
                    </div>

                    <div className="selection-counter">
                        {selectedNames.length} / 10 selected
                        {isSubmitted && <span className="submitted-badge">SUBMITTED</span>}
                    </div>

                    {selectedNames.length > 0 && (
                        <div className="selected-names">
                            <h3>Your Selections ({selectedNames.length})</h3>
                            <div className="name-chips">
                                {selectedNames.map(name => (
                                    <div key={name} className={`name-chip selected ${isSubmitted ? 'readonly' : ''}`}>
                                        <span>{name}</span>
                                        {!isSubmitted && (
                                            <button
                                                onClick={() => handleRemoveSelected(name)}
                                                className="remove-btn"
                                                aria-label={`Remove ${name}`}
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {!isSubmitted && (
                        <div className="search-section">
                            <input
                                type="text"
                                placeholder="Search names..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="search-input"
                            />
                        </div>
                    )}

                    {!isSubmitted && (
                        <div className="available-names">
                            <h3>
                                Available Classmates
                                {searchTerm && ` (${filteredAvailableNames.length} found)`}
                            </h3>
                            <div className="names-simple-list">
                                {filteredAvailableNames.map(name => {
                                    const isDisabled = selectedNames.length >= 10;  // Changed from 25 to 10

                                    return (
                                        <div
                                            key={name}
                                            onClick={() => !isDisabled && handleNameToggle(name)}
                                            className={`name-list-item ${isDisabled ? 'disabled' : ''}`}
                                        >
                                            <span className="name-text">{name}</span>
                                            <span className="add-btn">+</span>
                                        </div>
                                    );
                                })}
                                {filteredAvailableNames.length === 0 && (
                                    <div className="no-results">
                                        {searchTerm ? 'No names found matching your search.' : 'All classmates have been selected!'}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="action-section">
                        {isSubmitted ? (
                            <div className="submitted-message">
                            </div>
                        ) : (
                            <div className="action-buttons">
                                <button
                                    onClick={handleSaveDraft}
                                    disabled={saving || submitting}
                                    className="save-draft-btn"
                                >
                                    {saving ? 'Saving...' : 'Save Draft'}
                                </button>
                                <button
                                    onClick={handleSubmitList}
                                    disabled={saving || submitting || selectedNames.length === 0}
                                    className="submit-btn"
                                >
                                    {submitting ? 'Submitting...' : 'Submit List'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Home;