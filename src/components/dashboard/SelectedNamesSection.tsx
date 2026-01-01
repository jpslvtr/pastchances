import React from 'react';
import UserPhoto from '../shared/UserPhoto';

interface SelectedNamesSectionProps {
    selectedNames: string[];
    lockedCrushes: string[];
    onRemove: (name: string) => void;
    updating: boolean;
    userClass?: string;
}

export const SelectedNamesSection: React.FC<SelectedNamesSectionProps> = ({
    selectedNames,
    lockedCrushes,
    onRemove,
    updating,
    userClass = 'gsb'
}) => {
    if (selectedNames.length === 0) return null;

    return (
        <div className="selected-names">
            <h3>Your Selections ({selectedNames.length})</h3>
            <div className="name-chips">
                {selectedNames.map(name => {
                    const isLocked = lockedCrushes.includes(name);
                    return (
                        <div key={name} className={`name-chip ${isLocked ? 'locked' : 'selected'}`}>
                            <UserPhoto name={name} userClass={userClass} size="small" />
                            <span>{name}</span>
                            {isLocked ? (
                                <span className="lock-icon" title="Locked - you have matched with this person">🔒</span>
                            ) : (
                                <button
                                    onClick={() => onRemove(name)}
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
    );
};