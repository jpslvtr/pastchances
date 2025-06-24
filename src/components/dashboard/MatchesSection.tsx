import React from 'react';
import type { MatchInfo } from '../../types';
import { MatchItem } from '../shared/MatchItem';

interface MatchesSectionProps {
    matches: MatchInfo[];
}

export const MatchesSection: React.FC<MatchesSectionProps> = ({ matches }) => {
    if (!matches || matches.length === 0) return null;

    return (
        <div className="matches-section">
            <h2>🎉 You have {matches.length} match{matches.length > 1 ? 'es' : ''}!</h2>
            <div className="matches-list">
                {matches.map((match, index) => (
                    <MatchItem key={index} match={match} index={index} />
                ))}
            </div>
        </div>
    );
};