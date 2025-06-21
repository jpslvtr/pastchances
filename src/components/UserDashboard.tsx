import React from 'react';
import { GSB_CLASS_NAMES } from '../data/names';
import { UNDERGRAD_CLASS_NAMES } from '../data/names-undergrad';
import type { UserData } from '../types/userTypes';

interface UserDashboardProps {
    userData: UserData;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    selectedNames: string[];
    savedNames: string[];
    updating: boolean;
    error: string | null;
    handleNameToggle: (name: string) => void;
    handleRemoveSelected: (name: string) => void;
    handleUpdatePreferences: () => void;
}

const UserDashboard: React.FC<UserDashboardProps> = ({
    userData,
    searchTerm,
    setSearchTerm,
    selectedNames,
    savedNames,
    updating,
    error,
    handleNameToggle,
    handleRemoveSelected,
    handleUpdatePreferences
}) => {
    const hasMatches = userData?.matches && userData.matches.length > 0;
    const crushCount = userData?.crushCount || 0;
    const lockedCrushes = userData?.lockedCrushes || [];
    const hasUnsavedChanges = JSON.stringify(selectedNames.sort()) !== JSON.stringify(savedNames.sort());

    // Get the appropriate class names based on user's class
    const classNames = userData?.userClass === 'gsb' ? GSB_CLASS_NAMES : UNDERGRAD_CLASS_NAMES;
    const classDisplayName = userData?.userClass === 'gsb' ? 'GSB MBA' : 'Undergraduate';

    const filteredAvailableNames = React.useMemo(() => {
        const excludedNames = [...selectedNames];

        if (userData?.name) {
            excludedNames.push(userData.name);
        }

        const availableNames = classNames.filter(name => !excludedNames.includes(name));

        if (!searchTerm) return availableNames;

        return availableNames.filter(name =>
            name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [selectedNames, searchTerm, userData?.name, classNames]);

    return (
        <>
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
                <div className="class-indicator">
                    <span className="class-badge">{classDisplayName} Class of 2025</span>
                </div>
                <div className="instructions">
                    <ol>
                        <li>Select any classmates you'd like to connect with. Your selections are completely private - only you can see who you've chosen.</li>
                        <li>Click "Update Preferences" to save your changes. Matches appear automatically when someone you've selected also selects you. Matches are completely private.</li>
                        <li>You can add or remove names anytime. There's no limit on how many people you can select, and you can change your preferences as often as you want.</li>
                        <li>Once you match with someone, you cannot remove them from your list.</li>
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
                    Classmates
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
        </>
    );
};

export default UserDashboard;