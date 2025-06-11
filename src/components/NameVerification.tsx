import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';

const NameVerification: React.FC = () => {
    const { user, refreshUserData, logout } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [allNames, setAllNames] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const loadNames = async () => {
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

        loadNames();

        return () => {
            isMounted = false;
        };
    }, []);

    const filteredNames = useMemo(() => {
        if (!searchTerm) return allNames;

        return allNames.filter(name =>
            name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [allNames, searchTerm]);

    const handleNameSelect = useCallback(async (selectedName: string) => {
        if (!user || saving) return;

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
    }, [user, saving, refreshUserData]);

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
                    <p>Please select your name from the list below. This helps us match your Stanford email with the name we have for you.</p>

                    <div className="search-section">
                        <input
                            type="text"
                            placeholder="Search for your name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>

                    <div className="names-list">
                        <h3>
                            GSB MBA Class of 2025
                            {searchTerm && ` (${filteredNames.length} found)`}
                        </h3>
                        <div className="names-verification-list">
                            {filteredNames.map(name => (
                                <div
                                    key={name}
                                    onClick={() => !saving && handleNameSelect(name)}
                                    className={`name-verification-item ${saving ? 'disabled' : ''}`}
                                >
                                    <span className="name-text">{name}</span>
                                    <span className="select-btn">Select</span>
                                </div>
                            ))}
                            {filteredNames.length === 0 && (
                                <div className="no-results">
                                    {searchTerm ? 'No names found matching your search.' : 'No names available.'}
                                </div>
                            )}
                        </div>
                    </div>

                    {saving && (
                        <div className="saving-indicator">
                            Saving your selection...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NameVerification;