import React, { useState, useEffect, useMemo } from 'react';
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

    // Load the names from the text file and user's existing selections
    useEffect(() => {
        const loadData = async () => {
            try {
                // Load names from text file
                const response = await fetch('/files/names.txt');
                const text = await response.text();
                const names = text
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('Here\'s the list'))
                    .filter(line => line.length > 0);

                setAllNames(names);

                // Load user's existing selections
                if (user) {
                    await loadUserSelections();
                }
            } catch (error) {
                console.error('Error loading names:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [user]);

    const loadUserSelections = async () => {
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
        }
    };

    // Filter names based on search term, excluding already selected names AND the user's own verified name
    const filteredAvailableNames = useMemo(() => {
        const excludedNames = [...selectedNames];

        // Also exclude the user's own verified name so they can't select themselves
        if (userData?.verifiedName) {
            excludedNames.push(userData.verifiedName);
        }

        const availableNames = allNames.filter(name => !excludedNames.includes(name));

        if (!searchTerm) return availableNames;

        return availableNames.filter(name =>
            name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [allNames, selectedNames, searchTerm, userData?.verifiedName]);

    // Handle image load errors
    const handleImageError = () => {
        setImageError(true);
    };

    const getProfileImageUrl = () => {
        if (imageError) {
            return '/files/default-profile.png';
        }
        return userData?.photoURL || '/files/default-profile.png';
    };

    const handleNameToggle = (name: string) => {
        // Don't allow changes if already submitted
        if (userData?.submitted) return;

        setSelectedNames(prev => {
            if (prev.includes(name)) {
                return prev.filter(n => n !== name);
            } else if (prev.length < 25) {
                return [...prev, name];
            }
            return prev;
        });
    };

    const handleSaveDraft = async () => {
        if (!user || userData?.submitted) return;

        setSaving(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                crushes: selectedNames,
                updatedAt: new Date()
            });

            // Refresh user data in context
            await refreshUserData();

            alert('Your draft has been saved!');
        } catch (error) {
            console.error('Error saving draft:', error);
            alert('Failed to save draft. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleSubmitList = async () => {
        if (!user || userData?.submitted) return;

        // Confirm submission
        const confirmed = window.confirm(
            `Are you sure you want to submit your list? You will NOT be able to make changes after submission. You have ${selectedNames.length} names selected.`
        );

        if (!confirmed) return;

        setSubmitting(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                crushes: selectedNames,
                submitted: true,
                updatedAt: new Date()
            });

            // Refresh user data in context
            await refreshUserData();

            alert('Your list has been submitted! Check back for matches.');
        } catch (error) {
            console.error('Error submitting list:', error);
            alert('Failed to submit list. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemoveSelected = (nameToRemove: string) => {
        // Don't allow changes if already submitted
        if (userData?.submitted) return;

        setSelectedNames(prev => prev.filter(name => name !== nameToRemove));
    };

    if (loading) {
        return <div className="loading">Loading...</div>;
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
                    {/* Matches Section - Show only if user has submitted and has matches */}
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
                            <p>Select up to 25 classmates you'd like to "connect" with. Your selections are kept private and only visible to you unless there's a mutual match.</p>
                        )}
                    </div>

                    <div className="selection-counter">
                        {selectedNames.length} / 25 selected
                        {isSubmitted && <span className="submitted-badge">SUBMITTED</span>}
                    </div>

                    {/* Selected Names Section */}
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
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Search Section - Hide if submitted */}
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

                    {/* Available Names Section - Hide if submitted */}
                    {!isSubmitted && (
                        <div className="available-names">
                            <h3>
                                Available Classmates
                                {searchTerm && ` (${filteredAvailableNames.length} found)`}
                            </h3>
                            <div className="names-simple-list">
                                {filteredAvailableNames.map(name => {
                                    const isDisabled = selectedNames.length >= 25;

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

                    {/* Action Buttons */}
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