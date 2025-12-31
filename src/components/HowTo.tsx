import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from './shared/Navbar';
import '../styles/legal.css';

const HowTo: React.FC = () => {
    const { user, userData } = useAuth();
    const navigate = useNavigate();

    const handleBackToHome = () => {
        navigate('/');
    };

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
                            <p>2. Click "Update Preferences" to save your changes. Matches appear automatically when someone you've selected also selects you. Matches are completely private.</p>
                            <p>3. You can add or remove names anytime. There's no limit on how many people you can select, and you can change your preferences as often as you want.</p>
                            <p>4. Once you match with someone, you cannot remove them from your list.</p>
                        </div>

                        <button
                            onClick={handleBackToHome}
                            className="back-button"
                            style={{
                                marginTop: '30px',
                                padding: '12px 24px',
                                backgroundColor: '#8C1515',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '16px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#a01a1a'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#8C1515'}
                        >
                            Back to Home
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HowTo;