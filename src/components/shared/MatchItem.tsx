import React from 'react';
import type { MatchInfo } from '../../types';
import UserPhoto from './UserPhoto';

interface MatchItemProps {
    match: MatchInfo;
    index: number;
    userClass?: string;
}

export const MatchItem: React.FC<MatchItemProps> = ({ match, index, userClass = 'gsb' }) => (
    <div key={index} className="match-item">
        <UserPhoto name={match.name} userClass={userClass} size="medium" />
        <div className="match-details">
            <div className="match-name">{match.name}</div>
            <div className="match-email">{match.email}</div>
        </div>
    </div>
);