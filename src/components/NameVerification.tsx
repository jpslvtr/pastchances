import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
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
                const usersRef = collection(db, 'users');
                const q = query(usersRef, where('verifiedName', '!=', ''));
                const querySnapshot = await getDocs(q);

                const taken = new Set<string>();
                querySnapshot.forEach((doc) => {
                    const userData = doc.data();
                    if (userData.verifiedName && userData.verifiedName.trim() !== '') {
                        taken.add(userData.verifiedName);
                    }
                });

                setTakenNames(taken);
            } catch (error) {
                console.error('Error fetching taken names:', error);
                setError('Failed to load available names. Please refresh the page.');
            } finally {
                setLoading(false);
            }
        };

        fetchTakenNames();
    }, []);

    const filteredNames = useMemo(() => {
        const availableNames = GSB_CLASS_NAMES.filter(name => !takenNames.has(name));

        if (!searchTerm) return availableNames;

        return availableNames.filter(name =>
            name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm, takenNames]);

    const handleNameSelect = useCallback(async (selectedName: string) => {
        if (!user || saving || takenNames.has(selectedName)) return;

        setSaving(true);
        setError(null);

        try {
            // Double-check that the name is still available
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('verifiedName', '==', selectedName));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                setError('This name has already been taken by another user. Please select a different name.');
                // Refresh the taken names list
                const taken = new Set(takenNames);
                taken.add(selectedName);
                setTakenNames(taken);
                setSaving(false);
                return;
            }

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
                            {searchTerm && ` (${filteredNames.length} found)`}
                            {takenNames.size > 0 && (
                                <span style={{ color: '#666', fontSize: '12px', fontWeight: 'normal' }}>
                                    {' '}• {takenNames.size} names already taken
                                </span>
                            )}
                        </h3>
                        <div className="names-verification-list">
                            {filteredNames.map(name => {
                                const isTaken = takenNames.has(name);
                                return (
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
                                );
                            })}
                            {filteredNames.length === 0 && (
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