import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isAdminUser } from '../utils/adminUtils';
import { InstructionsSection } from './dashboard/InstructionsSection';
import '../styles/profile.css';

const Profile = () => {
    const { user, userData, signOut } = useAuth();
    const navigate = useNavigate();
    const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());

    const isAdmin = isAdminUser(user, userData);

    const handleImageError = useCallback((imageUrl: string) => {
        console.log('Image failed to load:', imageUrl);
        setFailedImageUrls(prev => new Set(prev).add(imageUrl));
    }, []);

    const getProfileImageUrl = useCallback(() => {
        const googlePhotoUrl = userData?.photoURL;
        const fallbackUrl = '/files/default-profile.png';

        if (!googlePhotoUrl) {
            return fallbackUrl;
        }

        if (failedImageUrls.has(googlePhotoUrl)) {
            return fallbackUrl;
        }

        return googlePhotoUrl;
    }, [userData?.photoURL, failedImageUrls]);

    const handleAdminToggle = useCallback(() => {
        navigate('/?admin=true');
    }, [navigate]);

    const currentImageUrl = getProfileImageUrl();
    const currentEmail = user?.email || '';

    const emails = [
        { label: '@stanford.edu', value: userData?.email || '' },
        { label: '@alumni.stanford.edu', value: userData?.emailAlumni || '' },
        { label: '@alumni.gsb.stanford.edu', value: userData?.emailAlumniGSB || '' }
    ];

    return (
        <div className="profile-container">
            <div className="profile-card">
                <div className="profile-header">
                    <button onClick={() => navigate('/')} className="back-button">
                        ← Back to Dashboard
                    </button>
                </div>

                <div className="profile-content">
                    <div className="profile-image-section">
                        <img
                            src={currentImageUrl}
                            alt="Profile"
                            className="profile-image-large"
                            onError={() => handleImageError(currentImageUrl)}
                            loading="lazy"
                        />
                        <h2 className="profile-name">{userData?.name || user?.displayName}</h2>
                    </div>

                    <div className="profile-emails-section">
                        <h3>Email Addresses</h3>
                        {emails.map((emailData, index) => (
                            <div key={index} className="email-item">
                                <div className="email-label">{emailData.label}</div>
                                <div className={`email-value ${emailData.value === currentEmail ? 'current-email' : ''}`}>
                                    {emailData.value || '(empty)'}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="profile-instructions-section">
                        <InstructionsSection />
                    </div>

                    <div className="profile-actions">
                        {isAdmin && (
                            <button
                                onClick={handleAdminToggle}
                                className="admin-toggle-btn"
                            >
                                Admin View
                            </button>
                        )}
                        <button className="logout-btn" onClick={signOut}>
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;