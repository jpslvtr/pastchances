import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navbar from './shared/Navbar';
import '../styles/legal.css';

const HowTo: React.FC = () => {
    const { user, userData } = useAuth();

    return (
        <div className="dashboard-container">
            <div className="dashboard-card">
                <Navbar
                    user={user}
                    userData={userData}
                />

                <div className="legal-content">
                    <h1>How To Use Second Chances</h1>

                    <div className="legal-section">
                        <div className="instructions-list">
                            <p>1. Select any classmates you'd like to connect with. Your selections are completely private - only you can see who you've chosen.</p>
                            <p>2. Click the save icon to save your changes. Matches appear automatically when someone you've selected also selects you. Matches are completely private.</p>
                            <p>3. You can add or remove names anytime. There's no limit on how many people you can select, and you can change your preferences as often as you want.</p>
                            <p>4. Once you match with someone, you cannot remove them from your list.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HowTo;