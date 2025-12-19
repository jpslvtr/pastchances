import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fuzzyNameMatch } from '../utils/emailUtils';

const NameSelection: React.FC = () => {
    const { user, nameOptions, selectName, logout } = useAuth();
    const [selecting, setSelecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Calculate match scores and check for high-confidence matches
    const { scoredOptions, hasHighConfidenceMatch } = useMemo(() => {
        if (!nameOptions || !user?.displayName) {
            return { scoredOptions: nameOptions || [], hasHighConfidenceMatch: false };
        }

        const googleName = user.displayName;
        const MIN_SCORE = 60;
        const HIGH_CONFIDENCE_SCORE = 75;

        const scored = nameOptions
            .map(name => ({
                name,
                score: fuzzyNameMatch(googleName, name)
            }))
            .filter(item => item.score >= MIN_SCORE)
            .sort((a, b) => b.score - a.score);

        const hasHighConfidence = scored.some(item => item.score >= HIGH_CONFIDENCE_SCORE);

        return {
            scoredOptions: scored.map(item => item.name),
            hasHighConfidenceMatch: hasHighConfidence
        };
    }, [nameOptions, user?.displayName]);

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

    const displayOptions = scoredOptions.length > 0 ? scoredOptions : nameOptions;

    return (
        <div className="verification-container">
            <div className="verification-card">
                <div className="verification-header">
                    <h1>Second Chances</h1>
                    <div className="user-info">
                        <span>{user?.email}</span>
                        <button className="logout-btn" onClick={logout}>Logout</button>
                    </div>
                </div>

                <div className="verification-content">
                    <h2>Select Your Name</h2>
                    {user?.displayName && (
                        <p style={{ fontSize: '0.9em', color: '#666', marginBottom: '10px' }}>
                            Google account name: <strong>{user.displayName}</strong>
                        </p>
                    )}
                    <p>Please select which of these options matches your identity:</p>

                    {displayOptions.length > 0 ? (
                        <>
                            <div className="names-list">
                                <h3>Potential Matches</h3>
                                <div className="names-verification-list">
                                    {displayOptions.map((name) => (
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

                            <div className="help-notice" style={{
                                marginTop: '20px',
                                padding: '12px',
                                background: '#f8f9fa',
                                borderRadius: '4px',
                                fontSize: '0.9em',
                                color: '#666'
                            }}>
                                {hasHighConfidenceMatch
                                    ? <>We found strong matches to your Google name. If none of these are correct, email <a href="mailto:jamespark@alumni.stanford.edu">jamespark@alumni.stanford.edu</a></>
                                    : <>Don't see your name? Email <a href="mailto:jamespark@alumni.stanford.edu">jamespark@alumni.stanford.edu</a> for assistance</>
                                }
                            </div>
                        </>
                    ) : (
                        <div style={{
                            marginTop: '20px',
                            padding: '20px',
                            background: '#f8f9fa',
                            borderRadius: '4px',
                            textAlign: 'center'
                        }}>
                            <p>We couldn't find any matching names.</p>
                            <p style={{ fontSize: '0.9em', color: '#666' }}>
                                Please email <a href="mailto:jamespark@alumni.stanford.edu">jamespark@alumni.stanford.edu</a> for assistance.
                            </p>
                        </div>
                    )}

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