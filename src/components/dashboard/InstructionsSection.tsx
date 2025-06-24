import React from 'react';

export const InstructionsSection: React.FC = () => (
    <div className="header-section">
        <div className="instructions">
            <ol>
                <li>Select any classmates you'd like to connect with. Your selections are completely private - only you can see who you've chosen.</li>
                <li>Click "Update Preferences" to save your changes. Matches appear automatically when someone you've selected also selects you. Matches are completely private.</li>
                <li>You can add or remove names anytime. There's no limit on how many people you can select, and you can change your preferences as often as you want.</li>
                <li>Once you match with someone, you cannot remove them from your list.</li>
            </ol>
        </div>
    </div>
);