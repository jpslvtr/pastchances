import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { doc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { GSB_CLASS_NAMES } from '../data/names';

const NameVerification: React.FC = () => {
    const { user, refreshUserData, logout } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [takenNames, setTakenNames] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchTakenNames = async () => {
            try {
                setLoading(true);
                setError(null);

                // Get all taken names from the takenNames collection
                const takenNamesRef = collection(db, 'takenNames');
                const querySnapshot = await getDocs(takenNamesRef);

                const taken = new Set<string>();
                querySnapshot.forEach((doc) => {
                    taken.add(doc.id); // Document ID is the taken name
                });

                setTakenNames(taken);

            } catch (error) {
                console.error('Error fetching taken names:', error);
                setError('Failed to load available names. Please refresh the page.');
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchTakenNames();
        }
    }, [user]);

    const allNamesWithStatus = useMemo(() => {
        return GSB_CLASS_NAMES.map(name => ({
            name,
            isTaken: takenNames.has(name),
            matchesSearch: !searchTerm || name.toLowerCase().includes(searchTerm.toLowerCase())
        })).filter(item => item.matchesSearch);
    }, [searchTerm, takenNames]);

    const handleNameSelect = useCallback(async (selectedName: string) => {
        if (!user || saving) return;

        // Don't allow selection of taken names
        if (takenNames.has(selectedName)) {
            setError('This name has already been taken by another user. Please select a different name.');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                verifiedName: selectedName,
                updatedAt: new Date()
            });

            await refreshUserData();
        } catch (error) {
            console.error('Error saving verified name:', error);
            setError('Failed to save your selection. Please try again.');
        } finally {
            setSaving(false);
        }
    }, [user, saving, refreshUserData, takenNames]);

    if (loading) {
        return <div className="loading">Loading available names...</div>;
    }

    if (error && takenNames.size === 0) {
        return (
            <div className="loading">
                <p style={{ color: 'red' }}>{error}</p>
                <button onClick={() => window.location.reload()}>Refresh Page</button>
            </div>
        );
    }

    return (
        <div className="verification-container">
            <div className="verification-card">
                <div className="verification-header">
                    <h1>Stanford Last Chances</h1>
                    <div className="user-info">
                        <span>{user?.email}</span>
                        <button className="logout-btn" onClick={logout}>Logout</button>
                    </div>
                </div>

                <div className="verification-content">
                    <h2>To ensure accuracy of matches, which Class of 2025 student are you?</h2>
                    <p>Please select <b>your name</b> from the list below, not your crush's name.</p>

                    <div className="search-section">
                        <input
                            type="text"
                            placeholder="Search for your name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>
                    <br></br>
                    <div className="names-list">
                        <h3>
                            GSB MBA Class of 2025
                            {searchTerm && ` (${allNamesWithStatus.length} found)`}
                        </h3>
                        <div className="names-verification-list">
                            {allNamesWithStatus.map(({ name, isTaken }) => (
                                <div
                                    key={name}
                                    onClick={() => !saving && !isTaken && handleNameSelect(name)}
                                    className={`name-verification-item ${saving || isTaken ? 'disabled' : ''}`}
                                >
                                    <span className="name-text">{name}</span>
                                    <span className={`select-btn ${isTaken ? 'taken' : ''}`}>
                                        {isTaken ? 'Taken' : 'Select'}
                                    </span>
                                </div>
                            ))}
                            {allNamesWithStatus.length === 0 && (
                                <div className="no-results">
                                    {searchTerm ? 'No available names found matching your search.' : 'No names available.'}
                                </div>
                            )}
                        </div>
                    </div>

                    {saving && (
                        <div className="saving-indicator">
                            Saving your selection...
                        </div>
                    )}

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

export default NameVerification;