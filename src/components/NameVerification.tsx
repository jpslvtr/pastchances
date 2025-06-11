import React, { useState, useEffect, useMemo } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';

const NameVerification: React.FC = () => {
    const { user, refreshUserData, logout } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [allNames, setAllNames] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Load the names from the text file
    useEffect(() => {
        const loadNames = async () => {
            try {
                const response = await fetch('/files/names.txt');
                const text = await response.text();
                const names = text
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('Here\'s the list'))
                    .filter(line => line.length > 0);

                setAllNames(names);
            } catch (error) {
                console.error('Error loading names:', error);
            } finally {
                setLoading(false);
            }
        };

        loadNames();
    }, []);

    // Filter names based on search term
    const filteredNames = useMemo(() => {
        if (!searchTerm) return allNames;

        return allNames.filter(name =>
            name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [allNames, searchTerm]);

    const handleNameSelect = async (selectedName: string) => {
        if (!user) return;

        setSaving(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                verifiedName: selectedName,
                updatedAt: new Date()
            });

            // Refresh user data to update the context
            await refreshUserData();

        } catch (error) {
            console.error('Error saving verified name:', error);
            alert('Failed to save your selection. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="loading">Loading...</div>;
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