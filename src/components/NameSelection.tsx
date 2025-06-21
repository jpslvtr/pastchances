import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const NameSelection: React.FC = () => {
    const { user, nameOptions, selectName, logout } = useAuth();
    const [selecting, setSelecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleNameSelect = async (selectedName: string) => {
        if (selecting) return;

        setSelecting(true);
        setError(null);

        try {
            await selectName(selectedName);
        } catch (error) {
            console.error('Error selecting name:', error);
            setError('Failed to save your selection. Please try again.');
        } finally {
            setSelecting(false);
        }
    };

    if (!nameOptions) {
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
                    <h2>Multiple matches found for your name</h2>
                    <p>Please select which of these options matches your identity:</p>

                    <div className="names-list">
                        <h3>Potential Matches</h3>
                        <div className="names-verification-list">
                            {nameOptions.map((name) => (
                                <div
                                    key={name}
                                    onClick={() => !selecting && handleNameSelect(name)}
                                    className={`name-verification-item ${selecting ? 'disabled' : ''}`}
                                >
                                    <span className="name-text">{name}</span>
                                    <span className="select-btn">
                                        Select
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {selecting && (
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

export default NameSelection;