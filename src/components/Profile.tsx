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
import type { UserData, PublicContact } from '../types/userTypes';
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
    const [publicContact, setPublicContact] = useState<PublicContact>({
        cell: '',
        instagram: '',
        linkedin: '',
        preferred: ''
    });
    const [contactErrors, setContactErrors] = useState<{
        cell?: string;
        instagram?: string;
        linkedin?: string;
        preferred?: string;
    }>({});
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
                    setPublicContact(currentUserData?.publicContact || {
                        cell: '',
                        instagram: '',
                        linkedin: '',
                        preferred: ''
                    });
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

    const formatCellPhone = (value: string): string => {
        const digits = value.replace(/\D/g, '');

        if (digits.length === 0) return '';
        if (digits.length <= 1) return `+${digits}`;
        if (digits.length <= 4) return `+${digits.slice(0, 1)} ${digits.slice(1)}`;
        if (digits.length <= 7) return `+${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4)}`;
        if (digits.length <= 10) return `+${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
        return `+${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 11)}`;
    };

    const validateCell = (cell: string): string | null => {
        if (!cell) return null;

        const phoneRegex = /^\+[\d\s\-()]+$/;

        if (!phoneRegex.test(cell)) {
            return 'Cell must start with country code (e.g., +1 234 567 8900)';
        }

        const digitCount = cell.replace(/\D/g, '').length;
        if (digitCount < 10 || digitCount > 15) {
            return 'Cell must have 10-15 digits';
        }

        return null;
    };

    const validateInstagram = (username: string): string | null => {
        if (!username) return null;

        const instagramRegex = /^[a-zA-Z0-9._]{1,30}$/;

        if (!instagramRegex.test(username)) {
            return 'Invalid Instagram username';
        }

        return null;
    };

    const validateLinkedIn = (username: string): string | null => {
        if (!username) return null;

        const linkedinRegex = /^[a-zA-Z0-9-]{3,100}$/;

        if (!linkedinRegex.test(username)) {
            return 'Invalid LinkedIn username';
        }

        return null;
    };

    const handleContactChange = (field: keyof PublicContact, value: string) => {
        let processedValue = value;

        if (field === 'cell') {
            processedValue = formatCellPhone(value);
        }

        setPublicContact(prev => ({
            ...prev,
            [field]: processedValue
        }));

        setContactErrors(prev => ({
            ...prev,
            [field]: undefined
        }));
    };

    const handlePreferredToggle = (field: 'cell' | 'instagram' | 'linkedin') => {
        setPublicContact(prev => ({
            ...prev,
            preferred: prev.preferred === field ? '' : field
        }));
    };

    const validateAllContactFields = (): boolean => {
        const errors: {
            cell?: string;
            instagram?: string;
            linkedin?: string;
            preferred?: string;
        } = {};
        let isValid = true;

        if (publicContact.cell) {
            const cellError = validateCell(publicContact.cell);
            if (cellError) {
                errors.cell = cellError;
                isValid = false;
            }
        }

        if (publicContact.instagram) {
            const instagramError = validateInstagram(publicContact.instagram);
            if (instagramError) {
                errors.instagram = instagramError;
                isValid = false;
            }
        }

        if (publicContact.linkedin) {
            const linkedinError = validateLinkedIn(publicContact.linkedin);
            if (linkedinError) {
                errors.linkedin = linkedinError;
                isValid = false;
            }
        }

        if (publicContact.preferred) {
            const preferredField = publicContact.preferred as 'cell' | 'instagram' | 'linkedin';
            if (!publicContact[preferredField]) {
                errors.preferred = `Cannot set ${publicContact.preferred} as preferred when it's empty`;
                isValid = false;
            }
        }

        setContactErrors(errors);
        return isValid;
    };

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
            const previewCircle = previewRef.current;
            if (!previewCircle) throw new Error('Preview element not found');

            const circleWidth = previewCircle.offsetWidth;

            const scale = targetSize / circleWidth;

            const scaledZoom = zoom * scale;
            const scaledX = position.x * scale;
            const scaledY = position.y * scale;

            ctx.save();
            ctx.beginPath();
            ctx.arc(targetSize / 2, targetSize / 2, targetSize / 2, 0, Math.PI * 2);
            ctx.clip();

            const imgWidth = img.naturalWidth * scaledZoom;
            const imgHeight = img.naturalHeight * scaledZoom;

            const drawX = (targetSize - imgWidth) / 2 + scaledX;
            const drawY = (targetSize - imgHeight) / 2 + scaledY;

            ctx.drawImage(img, drawX, drawY, imgWidth, imgHeight);
            ctx.restore();

            canvas.toBlob(async (blob) => {
                if (!blob) {
                    throw new Error('Failed to create blob from canvas');
                }

                const actualUid = getUserDocumentId(user!, currentUserData!);
                const timestamp = Date.now();
                const storageRef = ref(storage, `profile-photos/${actualUid}_${timestamp}.jpg`);

                await uploadBytes(storageRef, blob);
                const downloadURL = await getDownloadURL(storageRef);

                const userDocRef = doc(db, 'users', actualUid);
                await updateDoc(userDocRef, {
                    customPhotoURL: downloadURL,
                    updatedAt: new Date()
                });

                if (currentUserData?.customPhotoURL) {
                    try {
                        const oldPhotoRef = ref(storage, currentUserData.customPhotoURL);
                        await deleteObject(oldPhotoRef);
                    } catch (error) {
                        console.log('Could not delete old photo:', error);
                    }
                }

                await refreshUserData();

                setShowCropModal(false);
                setSelectedImage(null);
                setImageFile(null);
                setZoom(1);
                setPosition({ x: 0, y: 0 });
            }, 'image/jpeg', 0.9);

        } catch (error) {
            console.error('Error uploading photo:', error);
            alert('Failed to upload photo. Please try again.');
        } finally {
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

        if (!value.trim() || value.length < 2) {
            setSuggestions([]);
            return;
        }

        debounceTimer.current = setTimeout(async () => {
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=5&addressdetails=1`
                );
                const data = await response.json();

                const formattedSuggestions = data.map((item: any) => {
                    const parts = [];
                    if (item.address.city) parts.push(item.address.city);
                    else if (item.address.town) parts.push(item.address.town);
                    else if (item.address.village) parts.push(item.address.village);

                    if (item.address.state) parts.push(item.address.state);
                    if (item.address.country) parts.push(item.address.country);

                    return parts.join(', ');
                }).filter((suggestion: string, index: number, self: string[]) =>
                    suggestion && self.indexOf(suggestion) === index
                );

                setSuggestions(formattedSuggestions.slice(0, 5));
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

        if (!validateAllContactFields()) {
            return;
        }

        setSaving(true);

        try {
            const actualUid = getUserDocumentId(user!, currentUserData);
            const userDocRef = doc(db, 'users', actualUid);

            await updateDoc(userDocRef, {
                location,
                about,
                publicContact,
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
        setPublicContact(currentUserData?.publicContact || {
            cell: '',
            instagram: '',
            linkedin: '',
            preferred: ''
        });
        setContactErrors({});
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
    const viewingContact = profileData?.publicContact || { cell: '', instagram: '', linkedin: '', preferred: '' };

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

                        <div className="info-field-full">
                            <label>Contact:</label>
                            {isOwnProfile && isEditing ? (
                                <div className="contact-fields-plain">
                                    <div className="contact-field-plain">
                                        <label>Cell:</label>
                                        <div className="contact-input-with-star">
                                            <input
                                                type="text"
                                                value={publicContact.cell}
                                                onChange={(e) => handleContactChange('cell', e.target.value)}
                                                placeholder="+1 234 567 8900"
                                                className={`info-input-inline ${contactErrors.cell ? 'error' : ''}`}
                                            />
                                            <button
                                                type="button"
                                                className={`preferred-star ${publicContact.preferred === 'cell' ? 'active' : ''}`}
                                                onClick={() => handlePreferredToggle('cell')}
                                                disabled={!publicContact.cell}
                                                title="Set as preferred contact method"
                                            >
                                                {publicContact.preferred === 'cell' ? '★' : '☆'}
                                            </button>
                                        </div>
                                        {contactErrors.cell && <span className="contact-error">{contactErrors.cell}</span>}
                                    </div>

                                    <div className="contact-field-plain">
                                        <label>Instagram:</label>
                                        <div className="contact-input-with-star">
                                            <input
                                                type="text"
                                                value={publicContact.instagram}
                                                onChange={(e) => handleContactChange('instagram', e.target.value)}
                                                placeholder="username"
                                                className={`info-input-inline ${contactErrors.instagram ? 'error' : ''}`}
                                            />
                                            <button
                                                type="button"
                                                className={`preferred-star ${publicContact.preferred === 'instagram' ? 'active' : ''}`}
                                                onClick={() => handlePreferredToggle('instagram')}
                                                disabled={!publicContact.instagram}
                                                title="Set as preferred contact method"
                                            >
                                                {publicContact.preferred === 'instagram' ? '★' : '☆'}
                                            </button>
                                        </div>
                                        {contactErrors.instagram && <span className="contact-error">{contactErrors.instagram}</span>}
                                    </div>

                                    <div className="contact-field-plain">
                                        <label>LinkedIn:</label>
                                        <div className="contact-input-with-star">
                                            <input
                                                type="text"
                                                value={publicContact.linkedin}
                                                onChange={(e) => handleContactChange('linkedin', e.target.value)}
                                                placeholder="username"
                                                className={`info-input-inline ${contactErrors.linkedin ? 'error' : ''}`}
                                            />
                                            <button
                                                type="button"
                                                className={`preferred-star ${publicContact.preferred === 'linkedin' ? 'active' : ''}`}
                                                onClick={() => handlePreferredToggle('linkedin')}
                                                disabled={!publicContact.linkedin}
                                                title="Set as preferred contact method"
                                            >
                                                {publicContact.preferred === 'linkedin' ? '★' : '☆'}
                                            </button>
                                        </div>
                                        {contactErrors.linkedin && <span className="contact-error">{contactErrors.linkedin}</span>}
                                    </div>
                                    {contactErrors.preferred && <span className="contact-error general-error">{contactErrors.preferred}</span>}
                                </div>
                            ) : (
                                <div className="contact-display-plain">
                                    {isOwnProfile && !viewingContact.cell && !viewingContact.instagram && !viewingContact.linkedin ? (
                                        <>
                                            <div className="info-value-plain"></div>
                                            <div className="info-value-plain"></div>
                                            <div className="info-value-plain"></div>
                                        </>
                                    ) : (
                                        <>
                                            {(isOwnProfile || viewingContact.cell) && (
                                                <div className={`info-value-plain ${viewingContact.preferred === 'cell' ? 'preferred' : ''}`}>
                                                    {viewingContact.cell ? (
                                                        <a href={`tel:${viewingContact.cell}`} className="contact-link-plain">
                                                            {viewingContact.cell}
                                                        </a>
                                                    ) : (
                                                        ''
                                                    )}
                                                    {viewingContact.preferred === 'cell' && viewingContact.cell && <span className="preferred-badge">Preferred</span>}
                                                </div>
                                            )}
                                            {(isOwnProfile || viewingContact.instagram) && (
                                                <div className={`info-value-plain ${viewingContact.preferred === 'instagram' ? 'preferred' : ''}`}>
                                                    {viewingContact.instagram ? (
                                                        <a
                                                            href={`https://www.instagram.com/${viewingContact.instagram}/`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="contact-link-plain"
                                                        >
                                                            @{viewingContact.instagram}
                                                        </a>
                                                    ) : (
                                                        ''
                                                    )}
                                                    {viewingContact.preferred === 'instagram' && viewingContact.instagram && <span className="preferred-badge">Preferred</span>}
                                                </div>
                                            )}
                                            {(isOwnProfile || viewingContact.linkedin) && (
                                                <div className={`info-value-plain ${viewingContact.preferred === 'linkedin' ? 'preferred' : ''}`}>
                                                    {viewingContact.linkedin ? (
                                                        <a
                                                            href={`https://www.linkedin.com/in/${viewingContact.linkedin}/`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="contact-link-plain"
                                                        >
                                                            in/{viewingContact.linkedin}
                                                        </a>
                                                    ) : (
                                                        ''
                                                    )}
                                                    {viewingContact.preferred === 'linkedin' && viewingContact.linkedin && <span className="preferred-badge">Preferred</span>}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
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
                                min="1"
                                max="3"
                                step="0.1"
                                value={zoom}
                                onChange={(e) => setZoom(parseFloat(e.target.value))}
                            />
                        </div>

                        <canvas ref={canvasRef} style={{ display: 'none' }} />

                        <div className="crop-modal-actions">
                            <button
                                className="crop-confirm-btn"
                                onClick={handleCropConfirm}
                                disabled={uploadingPhoto}
                            >
                                {uploadingPhoto ? 'Uploading...' : 'Save Photo'}
                            </button>
                            <button
                                className="crop-cancel-btn"
                                onClick={handleCropCancel}
                                disabled={uploadingPhoto}
                            >
                                Cancel
                            </button>
                        </div>
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