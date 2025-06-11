import React, { useState, useMemo, useCallback } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { GSB_CLASS_NAMES } from '../data/names';

const NameVerification: React.FC = () => {
    const { user, refreshUserData, logout } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const filteredNames = useMemo(() => {
        if (!searchTerm) return GSB_CLASS_NAMES;

        return GSB_CLASS_NAMES.filter(name =>
            name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm]);

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