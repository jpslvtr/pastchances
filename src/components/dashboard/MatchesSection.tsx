import React from 'react';
import UserPhoto from '../shared/UserPhoto';
import type { UserData } from '../../types';

interface MatchesSectionProps {
    userData: UserData;
    photoCache: Map<string, string | null>;
    onMatchClick: (match: { name: string; email: string }) => void;
}

export const MatchesSection: React.FC<MatchesSectionProps> = ({
    userData,
    photoCache,
    onMatchClick
}) => {
    const hasMatches = userData?.matches && userData.matches.length > 0;

    if (!hasMatches) return null;

    return (
        <div className="matches-section">
            <h2>🎉 You have {userData.matches.length} match{userData.matches.length > 1 ? 'es' : ''}!</h2>
            <div className="matches-list">
                {userData.matches.map((match: { name: string; email: string }, index: number) => (
                    <div
                        key={index}
                        className="match-item clickable"
                        onClick={() => onMatchClick(match)}
                        style={{ cursor: 'pointer' }}
                    >
                        <UserPhoto
                            name={match.name}
                            userClass={userData.userClass}
                            size="medium"
                            photoUrl={photoCache.get(match.name)}
                        />
                        <div className="match-details">
                            <div className="match-name">{match.name}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};