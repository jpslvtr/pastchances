import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { InstructionsSection } from './dashboard/InstructionsSection';
import { db } from '../config/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getUserDocumentId } from '../utils';
import '../styles/profile.css';

const Profile = () => {
    const { user, userData, signOut, refreshUserData } = useAuth();
    const navigate = useNavigate();
    const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());
    const [isEditing, setIsEditing] = useState(false);
    const [location, setLocation] = useState('');
    const [about, setAbout] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (userData) {
            setLocation(userData.location || '');
            setAbout(userData.about || '');
        }
    }, [userData]);

    const handleImageError = useCallback((imageUrl: string) => {
        setFailedImageUrls(prev => new Set(prev).add(imageUrl));
    }, []);

    const getProfileImageUrl = useCallback(() => {
        const googlePhotoUrl = userData?.photoURL;
        const fallbackUrl = '/files/default-profile.png';
        if (!googlePhotoUrl || failedImageUrls.has(googlePhotoUrl)) {
            return fallbackUrl;
        }
        return googlePhotoUrl;
    }, [userData?.photoURL, failedImageUrls]);

    const handleSave = useCallback(async () => {
        if (!user || !userData || saving) return;

        setSaving(true);
        try {
            const actualUid = getUserDocumentId(user, userData);
            const userRef = doc(db, 'users', actualUid);

            await updateDoc(userRef, {
                location: location.trim(),
                about: about.trim(),
                updatedAt: new Date()
            });

            await refreshUserData();
            setIsEditing(false);

            const successDiv = document.createElement('div');
            successDiv.textContent = 'Profile updated!';
            successDiv.style.cssText = `
                position: fixed; top: 20px; right: 20px; background: #28a745; color: white;
                padding: 12px 20px; border-radius: 8px; z-index: 1000; font-weight: 500;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            `;
            document.body.appendChild(successDiv);
            setTimeout(() => document.body.contains(successDiv) && document.body.removeChild(successDiv), 3000);
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('Failed to update. Please try again.');
        } finally {
            setSaving(false);
        }
    }, [user, userData, location, about, saving, refreshUserData]);

    const handleCancel = useCallback(() => {
        setLocation(userData?.location || '');
        setAbout(userData?.about || '');
        setIsEditing(false);
    }, [userData]);

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'N/A';
        let date;
        if (timestamp.toDate) date = timestamp.toDate();
        else if (timestamp.seconds) date = new Date(timestamp.seconds * 1000);
        else if (timestamp._seconds) date = new Date(timestamp._seconds * 1000);
        else date = new Date(timestamp);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const currentImageUrl = getProfileImageUrl();
    const currentEmail = user?.email || '';

    return (
        <div className="profile-container">
            <div className="profile-card">
                <div className="profile-header">
                    <button onClick={() => navigate('/')} className="back-button">← Back to Dashboard</button>
                </div>

                <div className="profile-content">
                    <div className="profile-image-section">
                        <img src={currentImageUrl} alt="Profile" className="profile-image-large"
                            onError={() => handleImageError(currentImageUrl)} loading="lazy" />
                        <h2 className="profile-name">{userData?.name || user?.displayName}</h2>
                    </div>

                    <div className="profile-info-section">
                        <h3>Profile Information</h3>

                        <div className="info-field">
                            <label>Email</label>
                            <div className={`info-value readonly ${userData?.email === currentEmail ? 'current' : ''}`}>
                                {userData?.email || '(empty)'}
                            </div>
                        </div>

                        <div className="info-field">
                            <label>Stanford Alumni</label>
                            <div className={`info-value readonly ${userData?.emailAlumni === currentEmail ? 'current' : ''}`}>
                                {userData?.emailAlumni || '(empty)'}
                            </div>
                        </div>

                        <div className="info-field">
                            <label>Stanford GSB Alumni</label>
                            <div className={`info-value readonly ${userData?.emailAlumniGSB === currentEmail ? 'current' : ''}`}>
                                {userData?.emailAlumniGSB || '(empty)'}
                            </div>
                        </div>

                        <div className="info-field">
                            <label>Account Created</label>
                            <div className="info-value readonly">{formatDate(userData?.createdAt)}</div>
                        </div>

                        <div className="info-divider"></div>

                        <div className="info-field">
                            <label>Location</label>
                            {isEditing ? (
                                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                                    placeholder="City, State" className="info-input" />
                            ) : (
                                <div className="info-value">{userData?.location || '(not set)'}</div>
                            )}
                        </div>

                        <div className="info-field">
                            <label>About</label>
                            {isEditing ? (
                                <textarea value={about} onChange={(e) => setAbout(e.target.value)}
                                    placeholder="Tell us about yourself..." className="info-textarea"
                                    rows={4} maxLength={500} />
                            ) : (
                                <div className="info-value">{userData?.about || '(not set)'}</div>
                            )}
                        </div>
                    </div>

                    <div className="profile-instructions-section">
                        <InstructionsSection />
                    </div>

                    <div className="profile-actions">
                        {isEditing ? (
                            <>
                                <button className="save-btn" onClick={handleSave} disabled={saving}>
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button className="cancel-btn" onClick={handleCancel} disabled={saving}>Cancel</button>
                            </>
                        ) : (
                            <>
                                <button className="edit-btn" onClick={() => setIsEditing(true)}>Edit Profile</button>
                                <button className="logout-btn" onClick={signOut}>Logout</button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;