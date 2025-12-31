import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navbar from './shared/Navbar';
import { useState, useCallback, useEffect, useRef } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { getUserDocumentId } from '../utils';
import '../styles/profile.css';

const Profile = () => {
    const { user, userData, refreshUserData } = useAuth();
    const navigate = useNavigate();
    const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());
    const [isEditing, setIsEditing] = useState(false);
    const [location, setLocation] = useState('');
    const [about, setAbout] = useState('');
    const [saving, setSaving] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
        const customPhotoUrl = userData?.customPhotoURL;
        const googlePhotoUrl = userData?.photoURL;
        const fallbackUrl = '/files/default-profile.png';

        if (customPhotoUrl && !failedImageUrls.has(customPhotoUrl)) {
            return customPhotoUrl;
        }

        if (!googlePhotoUrl || failedImageUrls.has(googlePhotoUrl)) {
            return fallbackUrl;
        }

        return googlePhotoUrl;
    }, [userData?.photoURL, userData?.customPhotoURL, failedImageUrls]);

    const handlePhotoClick = () => {
        fileInputRef.current?.click();
    };

    const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user || !userData) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image must be smaller than 5MB');
            return;
        }

        setUploadingPhoto(true);
        try {
            const actualUid = getUserDocumentId(user, userData);

            // Delete old custom photo if exists
            if (userData.customPhotoURL) {
                try {
                    const oldPhotoRef = ref(storage, `profile-photos/${actualUid}`);
                    await deleteObject(oldPhotoRef);
                } catch (error) {
                    // Ignore errors if file doesn't exist
                    console.log('No previous photo to delete or deletion failed');
                }
            }

            // Upload new photo
            const storageRef = ref(storage, `profile-photos/${actualUid}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            // Update user document
            const userRef = doc(db, 'users', actualUid);
            await updateDoc(userRef, {
                customPhotoURL: downloadURL,
                updatedAt: new Date()
            });

            await refreshUserData();

            const successDiv = document.createElement('div');
            successDiv.textContent = 'Photo updated!';
            successDiv.style.cssText = `
                position: fixed; top: 20px; right: 20px; background: #28a745; color: white;
                padding: 12px 20px; border-radius: 8px; z-index: 1000; font-weight: 500;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            `;
            document.body.appendChild(successDiv);
            setTimeout(() => document.body.contains(successDiv) && document.body.removeChild(successDiv), 3000);
        } catch (error) {
            console.error('Error uploading photo:', error);
            alert('Failed to upload photo. Please try again.');
        } finally {
            setUploadingPhoto(false);
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const fetchLocationSuggestions = useCallback(async (input: string) => {
        if (input.length < 2) {
            setSuggestions([]);
            return;
        }

        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?` +
                `format=json&` +
                `q=${encodeURIComponent(input)}&` +
                `countrycodes=us&` +
                `limit=8&` +
                `addressdetails=1&` +
                `layer=address`,
                {
                    headers: {
                        'User-Agent': 'SecondChancesApp/1.0'
                    }
                }
            );

            if (!response.ok) {
                setSuggestions([]);
                return;
            }

            const data = await response.json();

            const uniqueSuggestions = new Map<string, boolean>();

            data.forEach((item: any) => {
                const city = item.address?.city ||
                    item.address?.town ||
                    item.address?.village ||
                    item.address?.hamlet || '';
                const state = item.address?.state || '';

                if (city && state) {
                    const formatted = `${city}, ${state}`;
                    uniqueSuggestions.set(formatted, true);
                }
            });

            setSuggestions(Array.from(uniqueSuggestions.keys()).slice(0, 5));
        } catch (error) {
            console.error('Error fetching suggestions:', error);
            setSuggestions([]);
        }
    }, []);

    const handleLocationChange = useCallback((value: string) => {
        setLocation(value);
        setShowSuggestions(true);

        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        debounceTimer.current = setTimeout(() => {
            fetchLocationSuggestions(value);
        }, 300);
    }, [fetchLocationSuggestions]);

    const handleSuggestionClick = useCallback((suggestion: string) => {
        setLocation(suggestion);
        setSuggestions([]);
        setShowSuggestions(false);
    }, []);

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
        setSuggestions([]);
        setShowSuggestions(false);
    }, [userData]);

    const handleAdminToggle = useCallback(() => {
        navigate('/');
    }, [navigate]);

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
        <div className="dashboard-container">
            <div className="dashboard-card">
                <Navbar
                    user={user}
                    userData={userData}
                    isAdminMode={false}
                    onAdminToggle={handleAdminToggle}
                />

                <div className="profile-content">
                    <div className="profile-image-section">
                        <div className="profile-image-container">
                            <img
                                src={currentImageUrl}
                                alt="Profile"
                                className="profile-image-large"
                                onError={() => handleImageError(currentImageUrl)}
                                loading="lazy"
                            />
                            <button
                                className="photo-edit-button"
                                onClick={handlePhotoClick}
                                disabled={uploadingPhoto}
                                title="Change photo"
                            >
                                {uploadingPhoto ? (
                                    <svg className="upload-spinner" viewBox="0 0 24 24">
                                        <circle className="spinner-circle" cx="12" cy="12" r="10" fill="none" strokeWidth="3" />
                                    </svg>
                                ) : (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                )}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoUpload}
                                style={{ display: 'none' }}
                            />
                        </div>
                        <h2 className="profile-name">{userData?.name || user?.displayName}</h2>
                    </div>

                    <div className="profile-info-section">
                        <h3>Account Information</h3>
                        <p className="visibility-note">Only visible to you</p>

                        <div className="info-row">
                            <label>Email:</label>
                            <div className={`info-value-inline readonly ${userData?.email === currentEmail ? 'current' : ''}`}>
                                {userData?.email || 'Not linked'}
                            </div>
                        </div>

                        <div className="info-row">
                            <label>Stanford Alumni:</label>
                            <div className={`info-value-inline readonly ${userData?.emailAlumni === currentEmail ? 'current' : ''}`}>
                                {userData?.emailAlumni || 'Not linked'}
                            </div>
                        </div>

                        <div className="info-row">
                            <label>GSB Alumni:</label>
                            <div className={`info-value-inline readonly ${userData?.emailAlumniGSB === currentEmail ? 'current' : ''}`}>
                                {userData?.emailAlumniGSB || 'Not linked'}
                            </div>
                        </div>

                        <div className="info-row">
                            <label>Account Created:</label>
                            <div className="info-value-inline readonly">{formatDate(userData?.createdAt)}</div>
                        </div>

                        <div className="info-divider"></div>

                        <h3>Public Information</h3>
                        <p className="visibility-note public">Visible to other users</p>

                        <div className="info-row location-row">
                            <label>Location:</label>
                            {isEditing ? (
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <input
                                        type="text"
                                        value={location}
                                        onChange={(e) => handleLocationChange(e.target.value)}
                                        onFocus={() => setShowSuggestions(true)}
                                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                        placeholder="Start typing city or zip..."
                                        className="info-input-inline"
                                    />
                                    {showSuggestions && suggestions.length > 0 && (
                                        <div className="location-suggestions">
                                            {suggestions.map((suggestion, index) => (
                                                <div
                                                    key={index}
                                                    className="suggestion-item"
                                                    onMouseDown={() => handleSuggestionClick(suggestion)}
                                                >
                                                    {suggestion}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="info-value-inline">{userData?.location || '(not set)'}</div>
                            )}
                        </div>

                        <div className="info-field-full">
                            <label>About:</label>
                            {isEditing ? (
                                <textarea value={about} onChange={(e) => setAbout(e.target.value)}
                                    placeholder="Tell us about yourself..." className="info-textarea"
                                    rows={4} maxLength={500} />
                            ) : (
                                <div className="info-value">{userData?.about || '(not set)'}</div>
                            )}
                        </div>
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
                            <button className="edit-btn" onClick={() => setIsEditing(true)}>Edit Profile</button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;