import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from './shared/Navbar';
import UserPhoto from './shared/UserPhoto';
import PhotoModal from './shared/PhotoModal';
import { useState, useCallback, useEffect, useRef } from 'react';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { getUserDocumentId } from '../utils';
import { GSB_CLASS_NAMES } from '../data/names';
import { UNDERGRAD_CLASS_NAMES } from '../data/names-undergrad';
import type { UserData } from '../types/userTypes';
import '../styles/profile.css';

const hashName = (name: string): string => {
    let hash = 0;
    const normalized = name.toLowerCase().trim();
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
};

const Profile = () => {
    const { userId: nameHash } = useParams<{ userId?: string }>();
    const { user, userData: currentUserData, refreshUserData } = useAuth();
    const navigate = useNavigate();
    const [profileData, setProfileData] = useState<UserData | null>(null);
    const [profileName, setProfileName] = useState<string>('');
    const [profileUserClass, setProfileUserClass] = useState<string>('gsb');
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [location, setLocation] = useState('');
    const [about, setAbout] = useState('');
    const [saving, setSaving] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showCropModal, setShowCropModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [showPhotoModal, setShowPhotoModal] = useState(false);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);

    const isOwnProfile = !nameHash || (currentUserData && hashName(currentUserData.name) === nameHash);

    useEffect(() => {
        const loadProfile = async () => {
            setLoadingProfile(true);
            try {
                if (isOwnProfile) {
                    setProfileData(currentUserData);
                    setProfileName(currentUserData?.name || '');
                    setProfileUserClass(currentUserData?.userClass || 'gsb');
                    setLocation(currentUserData?.location || '');
                    setAbout(currentUserData?.about || '');
                } else if (nameHash) {
                    const userClass = currentUserData?.userClass || 'gsb';
                    const classNames = userClass === 'gsb' ? GSB_CLASS_NAMES : UNDERGRAD_CLASS_NAMES;

                    const matchingName = classNames.find(name => hashName(name) === nameHash);

                    if (!matchingName) {
                        navigate('/');
                        return;
                    }

                    setProfileName(matchingName);
                    setProfileUserClass(userClass);

                    const usersRef = collection(db, 'users');
                    const q = query(
                        usersRef,
                        where('name', '==', matchingName),
                        where('userClass', '==', userClass)
                    );

                    const snapshot = await getDocs(q);

                    if (!snapshot.empty) {
                        setProfileData(snapshot.docs[0].data() as UserData);
                    } else {
                        setProfileData(null);
                    }
                }
            } catch (error) {
                console.error('Error loading profile:', error);
            } finally {
                setLoadingProfile(false);
            }
        };

        if (user && currentUserData) {
            loadProfile();
        }
    }, [nameHash, user, currentUserData, isOwnProfile, navigate]);

    const handlePhotoClick = () => {
        if (isOwnProfile) {
            fileInputRef.current?.click();
        } else {
            setShowPhotoModal(true);
        }
    };

    const handlePhotoViewClick = () => {
        setShowPhotoModal(true);
    };

    const resizeImageIfNeeded = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (file.size < 5 * 1024 * 1024) {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('Could not get canvas context'));
                        return;
                    }

                    const maxDimension = 2048;
                    let width = img.width;
                    let height = img.height;

                    if (width > maxDimension || height > maxDimension) {
                        if (width > height) {
                            height = (height / width) * maxDimension;
                            width = maxDimension;
                        } else {
                            width = (width / height) * maxDimension;
                            height = maxDimension;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);

                    resolve(canvas.toDataURL('image/jpeg', 0.85));
                };
                img.onerror = reject;
                img.src = e.target?.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const resizedImage = await resizeImageIfNeeded(file);
            setSelectedImage(resizedImage);
            setImageFile(file);
            setShowCropModal(true);
            setZoom(1);
            setPosition({ x: 0, y: 0 });
        } catch (error) {
            console.error('Error loading image:', error);
            alert('Failed to load image. Please try again.');
        }

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        setIsDragging(true);
        setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        setPosition({
            x: touch.clientX - dragStart.x,
            y: touch.clientY - dragStart.y
        });
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
    };

    const handleCropConfirm = async () => {
        if (!imageRef.current || !canvasRef.current || !imageFile) return;

        setUploadingPhoto(true);

        try {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not get canvas context');

            const targetSize = 400;
            canvas.width = targetSize;
            canvas.height = targetSize;

            const img = imageRef.current;
            const previewContainer = previewRef.current;
            if (!previewContainer) throw new Error('Preview container not found');

            const containerRect = previewContainer.getBoundingClientRect();
            const imageRect = img.getBoundingClientRect();

            const scaleX = img.naturalWidth / imageRect.width;
            const scaleY = img.naturalHeight / imageRect.height;

            const centerX = containerRect.width / 2;
            const centerY = containerRect.height / 2;

            const imageCenterX = (imageRect.left - containerRect.left + imageRect.width / 2);
            const imageCenterY = (imageRect.top - containerRect.top + imageRect.height / 2);

            const offsetX = (centerX - imageCenterX) * scaleX;
            const offsetY = (centerY - imageCenterY) * scaleY;

            const cropSize = Math.min(containerRect.width, containerRect.height);
            const sourceCropSize = cropSize * scaleX / zoom;

            const sourceX = (img.naturalWidth / 2 + offsetX) - (sourceCropSize / 2);
            const sourceY = (img.naturalHeight / 2 + offsetY) - (sourceCropSize / 2);

            ctx.drawImage(
                img,
                sourceX,
                sourceY,
                sourceCropSize,
                sourceCropSize,
                0,
                0,
                targetSize,
                targetSize
            );

            canvas.toBlob(async (blob) => {
                if (!blob) throw new Error('Failed to create blob');

                const actualUid = getUserDocumentId(user!, currentUserData);
                const storageRef = ref(storage, `profile-photos/${actualUid}`);

                try {
                    if (currentUserData?.customPhotoURL) {
                        const oldPhotoRef = ref(storage, `profile-photos/${actualUid}`);
                        await deleteObject(oldPhotoRef).catch(() => { });
                    }
                } catch (error) {
                    console.error('Error deleting old photo:', error);
                }

                await uploadBytes(storageRef, blob);
                const downloadURL = await getDownloadURL(storageRef);

                const userDocRef = doc(db, 'users', actualUid);
                await updateDoc(userDocRef, {
                    customPhotoURL: downloadURL,
                    updatedAt: new Date()
                });

                await refreshUserData();

                setShowCropModal(false);
                setSelectedImage(null);
                setImageFile(null);
                setUploadingPhoto(false);
                setZoom(1);
                setPosition({ x: 0, y: 0 });
            }, 'image/jpeg', 0.9);

        } catch (error) {
            console.error('Error uploading photo:', error);
            alert('Failed to upload photo. Please try again.');
            setUploadingPhoto(false);
        }
    };

    const handleCropCancel = () => {
        setShowCropModal(false);
        setSelectedImage(null);
        setImageFile(null);
        setZoom(1);
        setPosition({ x: 0, y: 0 });
    };

    const handleLocationChange = (value: string) => {
        setLocation(value);

        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        if (value.length < 2) {
            setSuggestions([]);
            return;
        }

        debounceTimer.current = setTimeout(async () => {
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&limit=5&addressdetails=1`
                );
                const data = await response.json();

                const locationSuggestions = data.map((item: any) => {
                    const parts = [];
                    if (item.address.city) parts.push(item.address.city);
                    else if (item.address.town) parts.push(item.address.town);
                    else if (item.address.village) parts.push(item.address.village);

                    if (item.address.country) parts.push(item.address.country);

                    return parts.join(', ');
                }).filter((location: string, index: number, self: string[]) =>
                    location && self.indexOf(location) === index
                );

                setSuggestions(locationSuggestions);
            } catch (error) {
                console.error('Error fetching location suggestions:', error);
            }
        }, 300);
    };

    const handleSuggestionClick = (suggestion: string) => {
        setLocation(suggestion);
        setSuggestions([]);
        setShowSuggestions(false);
    };

    const handleSave = async () => {
        if (!user || !currentUserData) return;

        setSaving(true);

        try {
            const actualUid = getUserDocumentId(user!, currentUserData);
            const userDocRef = doc(db, 'users', actualUid);

            await updateDoc(userDocRef, {
                location,
                about,
                updatedAt: new Date()
            });

            await refreshUserData();

            setIsEditing(false);
        } catch (error) {
            console.error('Error saving profile:', error);
            alert('Failed to save profile. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setLocation(currentUserData?.location || '');
        setAbout(currentUserData?.about || '');
    };

    const handleAdminToggle = useCallback(() => {
        navigate('/', { state: { openAdminMode: true } });
    }, [navigate]);

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'N/A';
        let date;
        if (timestamp.toDate) {
            date = timestamp.toDate();
        } else if (timestamp._seconds) {
            date = new Date(timestamp._seconds * 1000);
        } else {
            date = new Date(timestamp);
        }
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    if (loadingProfile) {
        return (
            <div className="dashboard-container">
                <div className="dashboard-card">
                    <div className="loading">Loading profile...</div>
                </div>
            </div>
        );
    }

    if (!profileName) {
        return (
            <div className="dashboard-container">
                <div className="dashboard-card">
                    <div className="loading">Profile not found</div>
                </div>
            </div>
        );
    }

    const currentEmail = user?.email || '';
    const displayPhotoUrl = profileData?.customPhotoURL || null;

    return (
        <div className="dashboard-container">
            <div className="dashboard-card">
                <Navbar
                    user={user}
                    userData={currentUserData}
                    isAdminMode={false}
                    onAdminToggle={handleAdminToggle}
                />

                <div className="profile-content">
                    <div className="profile-image-section">
                        <div className="profile-image-container">
                            <UserPhoto
                                name={profileName}
                                userClass={profileUserClass}
                                size="large"
                                photoUrl={profileData?.customPhotoURL || null}
                                onClick={handlePhotoViewClick}
                            />
                            {isOwnProfile && (
                                <>
                                    <button
                                        className="photo-edit-button"
                                        onClick={handlePhotoClick}
                                        disabled={uploadingPhoto}
                                        title="Change photo"
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                        </svg>
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handlePhotoSelect}
                                        style={{ display: 'none' }}
                                    />
                                </>
                            )}
                        </div>
                        <h2 className="profile-name">{profileName}</h2>
                    </div>

                    <div className="info-divider"></div>

                    <div className="profile-info-section">
                        <div className="info-row location-row">
                            <label>Location:</label>
                            {isOwnProfile && isEditing ? (
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <input
                                        type="text"
                                        value={location}
                                        onChange={(e) => handleLocationChange(e.target.value)}
                                        onFocus={() => setShowSuggestions(true)}
                                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                        placeholder="Start typing city, country..."
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
                                <div className="info-value-plain">{profileData?.location || ''}</div>
                            )}
                        </div>

                        <div className="info-field-full">
                            <label>About:</label>
                            {isOwnProfile && isEditing ? (
                                <textarea value={about} onChange={(e) => setAbout(e.target.value)}
                                    placeholder="Tell us about yourself..." className="info-textarea"
                                    rows={4} maxLength={500} />
                            ) : (
                                <div className="info-value-plain">{profileData?.about || ''}</div>
                            )}
                        </div>

                        {isOwnProfile && (
                            <>
                                <div className="profile-actions">
                                    {isEditing ? (
                                        <>
                                            <button className="save-btn" onClick={handleSave} disabled={saving}>
                                                {saving ? 'Saving...' : 'Save Changes'}
                                            </button>
                                            <button className="cancel-btn" onClick={handleCancel} disabled={saving}>Cancel</button>
                                        </>
                                    ) : (
                                        <button className="edit-btn" onClick={() => setIsEditing(true)}>Edit Public Profile</button>
                                    )}
                                </div>

                                <div className="info-divider"></div>

                                <h3>Account Information</h3>
                                <p className="visibility-note">Only visible to you</p>

                                <div className="info-row">
                                    <label>Email:</label>
                                    <div className={`info-value-plain ${profileData?.email === currentEmail ? 'current' : ''}`}>
                                        {profileData?.email || 'Not linked'}
                                    </div>
                                </div>

                                <div className="info-row">
                                    <label>Stanford Alumni:</label>
                                    <div className={`info-value-plain ${profileData?.emailAlumni === currentEmail ? 'current' : ''}`}>
                                        {profileData?.emailAlumni || 'Not linked'}
                                    </div>
                                </div>

                                <div className="info-row">
                                    <label>GSB Alumni:</label>
                                    <div className={`info-value-plain ${profileData?.emailAlumniGSB === currentEmail ? 'current' : ''}`}>
                                        {profileData?.emailAlumniGSB || 'Not linked'}
                                    </div>
                                </div>

                                <div className="info-row">
                                    <label>Account Created:</label>
                                    <div className="info-value-plain">{formatDate(profileData?.createdAt)}</div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {showCropModal && selectedImage && isOwnProfile && (
                <div className="crop-modal-overlay" onClick={handleCropCancel}>
                    <div className="crop-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Adjust Your Photo</h3>
                        <p className="crop-instructions">Drag to reposition, use slider to zoom</p>

                        <div
                            ref={previewRef}
                            className="crop-preview-container"
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                        >
                            <div className="crop-preview-circle">
                                <img
                                    ref={imageRef}
                                    src={selectedImage}
                                    alt="Preview"
                                    style={{
                                        transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                                        maxWidth: '100%',
                                        maxHeight: '100%',
                                        objectFit: 'contain',
                                        cursor: isDragging ? 'grabbing' : 'grab',
                                        userSelect: 'none',
                                        WebkitUserSelect: 'none'
                                    }}
                                    draggable={false}
                                    onLoad={() => {
                                        if (imageRef.current) {
                                            imageRef.current.style.display = 'block';
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        <div className="zoom-control">
                            <label>Zoom</label>
                            <input
                                type="range"
                                min="0.5"
                                max="3"
                                step="0.1"
                                value={zoom}
                                onChange={(e) => setZoom(parseFloat(e.target.value))}
                            />
                        </div>

                        <div className="crop-modal-actions">
                            <button
                                className="crop-confirm-btn"
                                onClick={handleCropConfirm}
                                disabled={uploadingPhoto}
                            >
                                {uploadingPhoto ? 'Uploading...' : 'Set Photo'}
                            </button>
                            <button
                                className="crop-cancel-btn"
                                onClick={handleCropCancel}
                                disabled={uploadingPhoto}
                            >
                                Cancel
                            </button>
                        </div>

                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                    </div>
                </div>
            )}

            {showPhotoModal && displayPhotoUrl && (
                <PhotoModal
                    photoUrl={displayPhotoUrl}
                    userName={profileName}
                    onClose={() => setShowPhotoModal(false)}
                />
            )}
        </div>
    );
};

export default Profile;