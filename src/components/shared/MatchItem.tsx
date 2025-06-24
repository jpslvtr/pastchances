import React from 'react';
import type { MatchInfo } from '../../types';

interface MatchItemProps {
    match: MatchInfo;
    index: number;
}

export const MatchItem: React.FC<MatchItemProps> = ({ match, index }) => (
    <div key={index} className="match-item">
        <div className="match-name">{match.name}</div>
        <div className="match-email">{match.email}</div>
    </div>
);