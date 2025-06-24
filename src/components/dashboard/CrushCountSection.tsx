import React from 'react';

interface CrushCountSectionProps {
    crushCount: number;
}

export const CrushCountSection: React.FC<CrushCountSectionProps> = ({ crushCount }) => {
    if (crushCount === 0) return null;

    return (
        <div className="crush-count-section">
            <h2>{crushCount} {crushCount === 1 ? 'person is' : 'people are'} crushing on you!</h2>
        </div>
    );
};