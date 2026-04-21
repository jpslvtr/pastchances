import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from './shared/Navbar';
import UserPhoto from './shared/UserPhoto';
import PhotoModal from './shared/PhotoModal';
import { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, serverTimestamp, collection, query, where, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { getUserDocumentId } from '../utils';
import { hashName } from '../utils/hashName';
import { COUNTRY_CODES } from '../config/countryCodes';
import { GSB_CLASS_NAMES } from '../data/names';
import { UNDERGRAD_CLASS_NAMES } from '../data/names-undergrad';
import type { UserData, PublicContact } from '../types';
import '../styles/profile.css';


const Profile = () => {
    const { userId: nameHash } = useParams<{ userId?: string }>();
    const { user, userData: currentUserData } = useAuth();
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
        x: '',
        linkedin: '',
        other: '',
        preferred: ''
    });
    const [countryCode, setCountryCode] = useState('+1');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [contactErrors, setContactErrors] = useState<{
        cell?: string;
        instagram?: string;
        x?: string;
        linkedin?: string;
        other?: string;
        preferred?: string;
    }>({});
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showCropModal, setShowCropModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [baseScale, setBaseScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [showPhotoModal, setShowPhotoModal] = useState(false);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const saveSuccessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);

    const isOwnProfile = !nameHash || (currentUserData && hashName(currentUserData.name) === nameHash);

    // Effect 1: own profile — sync from currentUserData (real-time via AuthContext listener)
    useEffect(() => {
        if (!isOwnProfile || !currentUserData) return;

        setProfileData(currentUserData);
        setProfileName(currentUserData.name || '');
        setProfileUserClass(currentUserData.userClass || 'gsb');
        setLoadingProfile(false);

        // Only reset form fields when not actively editing — preserves in-progress edits
        if (!isEditing) {
            setLocation(currentUserData.location || '');
            setAbout(currentUserData.about || '');

            const contact: PublicContact = {
                cell: currentUserData.publicContact?.cell || '',
                instagram: currentUserData.publicContact?.instagram || '',
                x: currentUserData.publicContact?.x || '',
                linkedin: currentUserData.publicContact?.linkedin || '',
                other: currentUserData.publicContact?.other || '',
                preferred: currentUserData.publicContact?.preferred || ''
            };
            setPublicContact(contact);

            if (contact.cell) {
                const parsed = parsePhoneNumber(contact.cell);
                setCountryCode(parsed.countryCode);
                const formatted = formatPhoneNumber(parsed.number.replace(/\D/g, ''), parsed.countryCode);
                setPhoneNumber(formatted);
            } else {
                setCountryCode('+1');
                setPhoneNumber('');
            }
        }
    }, [isOwnProfile, currentUserData, isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

    // Effect 2: other user's profile — real-time via onSnapshot
    useEffect(() => {
        if (isOwnProfile || !nameHash || !user || !currentUserData) return;

        const userClass = currentUserData.userClass || 'gsb';
        const classNames = userClass === 'gsb' ? GSB_CLASS_NAMES : UNDERGRAD_CLASS_NAMES;
        const matchingName = classNames.find(name => hashName(name) === nameHash);

        if (!matchingName) {
            navigate('/');
            return;
        }

        setProfileName(matchingName);
        setProfileUserClass(userClass);
        setLoadingProfile(true);

        const q = query(
            collection(db, 'users'),
            where('name', '==', matchingName),
            where('userClass', '==', userClass)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setProfileData(snapshot.empty ? null : snapshot.docs[0].data() as UserData);
            setLoadingProfile(false);
        }, (error) => {
            console.error('Error loading profile:', error);
            setLoadingProfile(false);
        });

        return () => unsubscribe();
    }, [isOwnProfile, nameHash, user, currentUserData, navigate]);

    useEffect(() => {
        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
            if (saveSuccessTimeoutRef.current) clearTimeout(saveSuccessTimeoutRef.current);
        };
    }, []);

    const parsePhoneNumber = (fullNumber: string): { countryCode: string; number: string } => {
        const digits = fullNumber.replace(/\D/g, '');

        // Find matching country code (check longer codes first)
        const sortedCodes = [...COUNTRY_CODES].sort((a, b) =>
            b.code.replace('+', '').length - a.code.replace('+', '').length
        );

        for (const cc of sortedCodes) {
            const codeDigits = cc.code.replace('+', '');
            if (digits.startsWith(codeDigits)) {
                return {
                    countryCode: cc.code,
                    number: digits.slice(codeDigits.length)
                };
            }
        }

        // Default to +1 if no match
        return {
            countryCode: '+1',
            number: digits.length > 1 ? digits.slice(1) : digits
        };
    };

    const formatPhoneNumber = (digits: string, code: string): string => {
        const country = COUNTRY_CODES.find(c => c.code === code);
        if (!country) return digits;
        return country.format(digits);
    };

    const validateCell = (code: string, number: string): string | null => {
        if (!number) return null;

        const digits = number.replace(/\D/g, '');
        const country = COUNTRY_CODES.find(c => c.code === code);

        if (!country) {
            return 'Invalid country code';
        }

        if (digits.length < country.minDigits) {
            return `Phone number must have at least ${country.minDigits} digits`;
        }

        if (digits.length > country.maxDigits) {
            return `Phone number must have at most ${country.maxDigits} digits`;
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

    const validateX = (username: string): string | null => {
        if (!username) return null;

        // Username validation (1-15 characters, alphanumeric and underscores)
        const xUsernameRegex = /^[a-zA-Z0-9_]{1,15}$/;

        if (!xUsernameRegex.test(username)) {
            return 'Invalid X username (1-15 characters, letters, numbers, underscores only)';
        }

        return null;
    };

    const handlePhoneNumberChange = (value: string) => {
        // Strip all non-digits first to enforce proper formatting
        const digits = value.replace(/\D/g, '');
        const formatted = formatPhoneNumber(digits, countryCode);
        setPhoneNumber(formatted);

        setContactErrors(prev => ({
            ...prev,
            cell: undefined
        }));
    };

    const handleCountryCodeChange = (code: string) => {
        setCountryCode(code);
        // Reformat the existing number with the new country code
        const digits = phoneNumber.replace(/\D/g, '');
        const formatted = formatPhoneNumber(digits, code);
        setPhoneNumber(formatted);

        setContactErrors(prev => ({
            ...prev,
            cell: undefined
        }));
    };

    const handleContactChange = (field: Exclude<keyof PublicContact, 'cell'>, value: string) => {
        setPublicContact(prev => ({
            ...prev,
            [field]: value
        }));

        setContactErrors(prev => ({
            ...prev,
            [field]: undefined
        }));
    };

    const handlePreferredToggle = (field: 'cell' | 'instagram' | 'x' | 'linkedin' | 'other') => {
        setPublicContact(prev => ({
            ...prev,
            preferred: prev.preferred === field ? '' : field
        }));
    };

    const validateAllContactFields = (): boolean => {
        const errors: {
            cell?: string;
            instagram?: string;
            x?: string;
            linkedin?: string;
            other?: string;
            preferred?: string;
        } = {};
        let isValid = true;

        if (phoneNumber) {
            const cellError = validateCell(countryCode, phoneNumber);
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

        if (publicContact.x) {
            const xError = validateX(publicContact.x);
            if (xError) {
                errors.x = xError;
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

        // Other field is free-text, no validation needed

        if (publicContact.preferred) {
            const preferredField = publicContact.preferred as 'cell' | 'instagram' | 'x' | 'linkedin' | 'other';
            if (preferredField === 'cell' && !phoneNumber) {
                errors.preferred = 'Cannot set cell as preferred when it\'s empty';
                isValid = false;
            } else if (preferredField !== 'cell' && !publicContact[preferredField]) {
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
        } else if (profileData?.customPhotoURL) {
            setShowPhotoModal(true);
        }
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
            setBaseScale(1);
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

            const scaledZoom = zoom * baseScale * scale;
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

            // Wrap toBlob in a Promise so errors propagate and we can await completion
            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob(
                    (b) => (b ? resolve(b) : reject(new Error('Canvas produced empty blob'))),
                    'image/jpeg',
                    0.9
                );
            });

            const actualUid = getUserDocumentId(user!, currentUserData!);
            const timestamp = Date.now();
            const storageRef = ref(storage, `profile-photos/${user!.uid}_${timestamp}.jpg`);

            await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(storageRef);

            const userDocRef = doc(db, 'users', actualUid);
            await updateDoc(userDocRef, {
                customPhotoURL: downloadURL,
                updatedAt: serverTimestamp()
            });

            if (currentUserData?.customPhotoURL) {
                try {
                    const oldPhotoRef = ref(storage, currentUserData.customPhotoURL);
                    await deleteObject(oldPhotoRef);
                } catch {
                    // Old photo cleanup is non-critical
                }
            }

            setShowCropModal(false);
            setSelectedImage(null);
            setImageFile(null);
            setZoom(1);
            setBaseScale(1);
            setPosition({ x: 0, y: 0 });

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
        setBaseScale(1);
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
        setSaveError(null);

        try {
            const actualUid = getUserDocumentId(user!, currentUserData);
            const userDocRef = doc(db, 'users', actualUid);

            const fullPhoneNumber = phoneNumber ? `${countryCode} ${phoneNumber}` : '';

            await updateDoc(userDocRef, {
                location,
                about,
                publicContact: {
                    ...publicContact,
                    cell: fullPhoneNumber
                },
                updatedAt: serverTimestamp()
            });

            setIsEditing(false);
            if (saveSuccessTimeoutRef.current) clearTimeout(saveSuccessTimeoutRef.current);
            setSaveSuccess(true);
            saveSuccessTimeoutRef.current = setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error('Error saving profile:', error);
            setSaveError('Failed to save profile. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setLocation(currentUserData?.location || '');
        setAbout(currentUserData?.about || '');

        const contact: PublicContact = {
            cell: currentUserData?.publicContact?.cell || '',
            instagram: currentUserData?.publicContact?.instagram || '',
            x: currentUserData?.publicContact?.x || '',
            linkedin: currentUserData?.publicContact?.linkedin || '',
            other: currentUserData?.publicContact?.other || '',
            preferred: currentUserData?.publicContact?.preferred || ''
        };

        setPublicContact(contact);

        if (contact.cell) {
            const parsed = parsePhoneNumber(contact.cell);
            setCountryCode(parsed.countryCode);
            // Format the parsed number to include spaces
            const formatted = formatPhoneNumber(parsed.number.replace(/\D/g, ''), parsed.countryCode);
            setPhoneNumber(formatted);
        } else {
            setCountryCode('+1');
            setPhoneNumber('');
        }

        setContactErrors({});
    };

    const viewingContact: PublicContact = isOwnProfile ? publicContact : {
        cell: profileData?.publicContact?.cell || '',
        instagram: profileData?.publicContact?.instagram || '',
        x: profileData?.publicContact?.x || '',
        linkedin: profileData?.publicContact?.linkedin || '',
        other: profileData?.publicContact?.other || '',
        preferred: profileData?.publicContact?.preferred || ''
    };

    const hasAnyContact = !!(viewingContact.cell || viewingContact.instagram || viewingContact.x || viewingContact.linkedin || viewingContact.other);

    if (loadingProfile) {
        return <div className="loading">Loading...</div>;
    }

    return (
        <>
        {saveSuccess && (
            <div style={{
                position: 'fixed',
                top: 'max(20px, env(safe-area-inset-top))',
                right: '20px',
                background: '#28a745',
                color: 'white',
                padding: '12px 20px',
                borderRadius: '8px',
                zIndex: 1000,
                fontWeight: 500,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                pointerEvents: 'none'
            }}>
                Profile updated!
            </div>
        )}
        <div className="dashboard-container">
            <div className="dashboard-card">
                <Navbar user={user} userData={currentUserData} />

                <div className="profile-container">
                    {nameHash && (
                        <button onClick={() => navigate('/')} className="back-btn">
                            ← Classmates
                        </button>
                    )}
                    <div className="profile-header">
                        <div
                            className="profile-photo-wrapper"
                            onClick={handlePhotoClick}
                            style={{ cursor: isOwnProfile || profileData?.customPhotoURL ? 'pointer' : 'default' }}
                        >
                            <UserPhoto
                                name={profileName}
                                userClass={profileUserClass}
                                size="large"
                                photoUrl={isOwnProfile ?
                                    (currentUserData?.customPhotoURL || null) :
                                    (profileData?.customPhotoURL || null)
                                }
                            />
                            {isOwnProfile && (
                                <div className="photo-edit-overlay">
                                    <span>✎</span>
                                </div>
                            )}
                        </div>
                        <h2>{profileName}</h2>

                        {isOwnProfile && (
                            <div className="profile-actions">
                                {!isEditing ? (
                                    <button onClick={() => setIsEditing(true)} className="edit-btn">
                                        Edit Profile
                                    </button>
                                ) : (
                                    <>
                                        <div className="edit-actions">
                                            <button onClick={handleSave} disabled={saving} className="save-btn">
                                                {saving ? 'Saving...' : 'Save'}
                                            </button>
                                            <button onClick={handleCancel} disabled={saving} className="cancel-btn">
                                                Cancel
                                            </button>
                                        </div>
                                        {saveError && (
                                            <div className="error-message" style={{ marginTop: '8px', textAlign: 'center' }}>
                                                {saveError}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="profile-info-section">
                        {(isOwnProfile || profileData?.location) && (
                        <div className="info-row location-row">
                            <label>Location:</label>
                            {isOwnProfile && isEditing ? (
                                <div style={{ position: 'relative', flex: 1, width: '100%' }}>
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
                                <div style={{ flex: 1, width: '100%' }}>
                                    <div className="info-value-plain">
                                        {(isOwnProfile ? location : profileData?.location) || '—'}
                                    </div>
                                </div>
                            )}
                        </div>
                        )}

                        {(isOwnProfile || profileData?.about) && (
                        <div className="info-row">
                            <label>About:</label>
                            {isOwnProfile && isEditing ? (
                                <div style={{ flex: 1, width: '100%' }}>
                                    <textarea
                                        value={about}
                                        onChange={(e) => setAbout(e.target.value)}
                                        placeholder="Tell your classmates a bit about yourself..."
                                        className="info-input-inline"
                                        rows={3}
                                        maxLength={500}
                                        style={{ resize: 'vertical', width: '100%' }}
                                    />
                                    <div className={`char-count${about.length > 450 ? ' near-limit' : ''}`}>
                                        {about.length}/500
                                    </div>
                                </div>
                            ) : (
                                <div style={{ flex: 1, width: '100%' }}>
                                    <div className="info-value-plain" style={{ whiteSpace: 'pre-wrap' }}>
                                        {(isOwnProfile ? about : profileData?.about) || '—'}
                                    </div>
                                </div>
                            )}
                        </div>
                        )}

                        {(isOwnProfile || hasAnyContact) && (
                        <div className="info-row">
                            <label>Contact:</label>
                            {isOwnProfile && isEditing ? (
                                <div className="contact-fields-plain">
                                    <div className="contact-field-plain">
                                        <label>Cell:</label>
                                        <div className="contact-input-with-star">
                                            <div className="phone-input-group">
                                                <select
                                                    value={countryCode}
                                                    onChange={(e) => handleCountryCodeChange(e.target.value)}
                                                    className="country-code-select"
                                                >
                                                    {COUNTRY_CODES.map((country) => (
                                                        <option key={country.code} value={country.code}>
                                                            {country.code} {country.country}
                                                        </option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="text"
                                                    value={phoneNumber}
                                                    onChange={(e) => handlePhoneNumberChange(e.target.value)}
                                                    placeholder={COUNTRY_CODES.find(c => c.code === countryCode)?.code === '+1' ? '234 567 8900' : 'Phone number'}
                                                    className={`phone-number-input ${contactErrors.cell ? 'error' : ''}`}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                className={`preferred-star ${publicContact.preferred === 'cell' ? 'active' : ''}`}
                                                onClick={() => handlePreferredToggle('cell')}
                                                disabled={!phoneNumber}
                                                title="Set as preferred contact method"
                                            >
                                                {publicContact.preferred === 'cell' ? '★' : '☆'}
                                            </button>
                                        </div>
                                        {contactErrors.cell && <span className="contact-error">{contactErrors.cell}</span>}
                                    </div>

                                    <div className="contact-field-plain">
                                        <label>Instagram: <span className="contact-url-hint">instagram.com/</span></label>
                                        <div className="contact-input-with-star">
                                            <input
                                                type="text"
                                                value={publicContact.instagram}
                                                onChange={(e) => handleContactChange('instagram', e.target.value)}
                                                placeholder="username"
                                                className={`info-input-inline ${contactErrors.instagram ? 'error' : ''}`}
                                                style={{ flex: 1 }}
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
                                        <label>X: <span className="contact-url-hint">x.com/</span></label>
                                        <div className="contact-input-with-star">
                                            <input
                                                type="text"
                                                value={publicContact.x}
                                                onChange={(e) => handleContactChange('x', e.target.value)}
                                                placeholder="username"
                                                className={`info-input-inline ${contactErrors.x ? 'error' : ''}`}
                                                style={{ flex: 1 }}
                                            />
                                            <button
                                                type="button"
                                                className={`preferred-star ${publicContact.preferred === 'x' ? 'active' : ''}`}
                                                onClick={() => handlePreferredToggle('x')}
                                                disabled={!publicContact.x}
                                                title="Set as preferred contact method"
                                            >
                                                {publicContact.preferred === 'x' ? '★' : '☆'}
                                            </button>
                                        </div>
                                        {contactErrors.x && <span className="contact-error">{contactErrors.x}</span>}
                                    </div>

                                    <div className="contact-field-plain">
                                        <label>LinkedIn: <span className="contact-url-hint">linkedin.com/in/</span></label>
                                        <div className="contact-input-with-star">
                                            <input
                                                type="text"
                                                value={publicContact.linkedin}
                                                onChange={(e) => handleContactChange('linkedin', e.target.value)}
                                                placeholder="your-profile"
                                                className={`info-input-inline ${contactErrors.linkedin ? 'error' : ''}`}
                                                style={{ flex: 1 }}
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

                                    <div className="contact-field-plain">
                                        <label>Other:</label>
                                        <div className="contact-input-with-star">
                                            <input
                                                type="text"
                                                value={publicContact.other}
                                                onChange={(e) => handleContactChange('other', e.target.value)}
                                                placeholder="Any other contact method"
                                                className={`info-input-inline ${contactErrors.other ? 'error' : ''}`}
                                            />
                                            <button
                                                type="button"
                                                className={`preferred-star ${publicContact.preferred === 'other' ? 'active' : ''}`}
                                                onClick={() => handlePreferredToggle('other')}
                                                disabled={!publicContact.other}
                                                title="Set as preferred contact method"
                                            >
                                                {publicContact.preferred === 'other' ? '★' : '☆'}
                                            </button>
                                        </div>
                                        {contactErrors.other && <span className="contact-error">{contactErrors.other}</span>}
                                    </div>
                                    {contactErrors.preferred && <span className="contact-error general-error">{contactErrors.preferred}</span>}
                                </div>
                            ) : (
                                <div style={{ flex: 1 }}>
                                    {hasAnyContact ? (
                                        <div className="contact-display-plain">
                                            {viewingContact.cell && (
                                                <div className={`info-value-plain ${viewingContact.preferred === 'cell' ? 'preferred' : ''}`}>
                                                    <strong>Cell: </strong>
                                                    <a href={`sms:${viewingContact.cell.replace(/\s/g, '')}`} className="contact-link-plain">
                                                        {viewingContact.cell}
                                                    </a>
                                                    {viewingContact.preferred === 'cell' && <span className="preferred-badge">Preferred</span>}
                                                </div>
                                            )}
                                            {viewingContact.instagram && (
                                                <div className={`info-value-plain ${viewingContact.preferred === 'instagram' ? 'preferred' : ''}`}>
                                                    <strong>Instagram: </strong>
                                                    <a
                                                        href={`https://www.instagram.com/${viewingContact.instagram.replace(/\/+$/, '')}/`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="contact-link-plain"
                                                    >
                                                        https://www.instagram.com/{viewingContact.instagram.replace(/\/+$/, '')}/
                                                    </a>
                                                    {viewingContact.preferred === 'instagram' && <span className="preferred-badge">Preferred</span>}
                                                </div>
                                            )}
                                            {viewingContact.x && (
                                                <div className={`info-value-plain ${viewingContact.preferred === 'x' ? 'preferred' : ''}`}>
                                                    <strong>X: </strong>
                                                    <a
                                                        href={`https://x.com/${viewingContact.x.replace(/\/+$/, '')}/`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="contact-link-plain"
                                                    >
                                                        https://x.com/{viewingContact.x.replace(/\/+$/, '')}/
                                                    </a>
                                                    {viewingContact.preferred === 'x' && <span className="preferred-badge">Preferred</span>}
                                                </div>
                                            )}
                                            {viewingContact.linkedin && (
                                                <div className={`info-value-plain ${viewingContact.preferred === 'linkedin' ? 'preferred' : ''}`}>
                                                    <strong>LinkedIn: </strong>
                                                    <a
                                                        href={`https://www.linkedin.com/in/${viewingContact.linkedin.replace(/\/+$/, '')}/`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="contact-link-plain"
                                                    >
                                                        https://www.linkedin.com/in/{viewingContact.linkedin.replace(/\/+$/, '')}/
                                                    </a>
                                                    {viewingContact.preferred === 'linkedin' && <span className="preferred-badge">Preferred</span>}
                                                </div>
                                            )}
                                            {viewingContact.other && (
                                                <div className={`info-value-plain ${viewingContact.preferred === 'other' ? 'preferred' : ''}`}>
                                                    <strong>Other: </strong>
                                                    {viewingContact.other.match(/^(https?:\/\/|www\.)/i) ? (
                                                        <a
                                                            href={viewingContact.other.startsWith('http') ? viewingContact.other : `https://${viewingContact.other}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="contact-link-plain"
                                                        >
                                                            {viewingContact.other}
                                                        </a>
                                                    ) : (
                                                        <span className="contact-link-plain">{viewingContact.other}</span>
                                                    )}
                                                    {viewingContact.preferred === 'other' && <span className="preferred-badge">Preferred</span>}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="info-value-plain">—</div>
                                    )}
                                </div>
                            )}
                        </div>
                        )}
                    </div>

                    {isOwnProfile && (
                        <>
                            <div className="profile-section-divider"></div>
                            <div className="account-information">
                                <p className="account-info-subtitle">Only visible to you</p>

                                <div className="profile-info">
                                    <div className="info-row">
                                        <label>Email:</label>
                                        <div className={`info-value-plain ${user?.email === currentUserData?.email ? 'current-email' : ''}`}>
                                            {currentUserData?.email}
                                        </div>
                                    </div>

                                    {currentUserData?.emailAlumni && (
                                        <div className="info-row">
                                            <label>Stanford Alumni:</label>
                                            <div className={`info-value-plain ${user?.email === currentUserData?.emailAlumni ? 'current-email' : ''}`}>
                                                {currentUserData.emailAlumni}
                                            </div>
                                        </div>
                                    )}

                                    {currentUserData?.emailAlumniGSB && (
                                        <div className="info-row">
                                            <label>GSB Alumni:</label>
                                            <div className={`info-value-plain ${user?.email === currentUserData?.emailAlumniGSB ? 'current-email' : ''}`}>
                                                {currentUserData.emailAlumniGSB}
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="info-row">
                                        <label>Account Created:</label>
                                        <div className="info-value-plain">
                                            {currentUserData?.createdAt?.toDate?.()?.toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            }) || 'Unknown'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    style={{ display: 'none' }}
                />

                {showCropModal && selectedImage && (
                    <div className="crop-modal-overlay">
                        <div className="crop-modal">
                            <h3>Adjust Your Photo</h3>
                            <p className="crop-instructions">
                                Zoom and drag to position your photo
                            </p>

                            <div
                                className="crop-preview-container"
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                                onTouchStart={handleTouchStart}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                            >
                                <div
                                    ref={previewRef}
                                    className="crop-preview-circle"
                                    style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                                >
                                    <img
                                        ref={imageRef}
                                        src={selectedImage}
                                        alt="Preview"
                                        onLoad={(e) => {
                                            const img = e.currentTarget;
                                            const circleSize = previewRef.current?.offsetWidth || 300;
                                            const scale = Math.max(circleSize / img.naturalWidth, circleSize / img.naturalHeight);
                                            setBaseScale(scale);
                                        }}
                                        style={{
                                            transform: `scale(${zoom * baseScale}) translate(${position.x / (zoom * baseScale)}px, ${position.y / (zoom * baseScale)}px)`,
                                            maxWidth: 'none',
                                            maxHeight: 'none',
                                            userSelect: 'none',
                                            pointerEvents: 'none'
                                        }}
                                        draggable={false}
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
                                    className="zoom-slider"
                                />
                            </div>

                            <div className="crop-modal-actions">
                                <button
                                    onClick={handleCropCancel}
                                    disabled={uploadingPhoto}
                                    className="cancel-btn"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCropConfirm}
                                    disabled={uploadingPhoto}
                                    className="save-btn"
                                >
                                    {uploadingPhoto ? 'Uploading...' : 'Save Photo'}
                                </button>
                            </div>

                            <canvas ref={canvasRef} style={{ display: 'none' }} />
                        </div>
                    </div>
                )}

                {showPhotoModal && (profileData?.customPhotoURL) && (
                    <PhotoModal
                        photoUrl={profileData.customPhotoURL}
                        userName={profileName}
                        onClose={() => setShowPhotoModal(false)}
                    />
                )}
            </div>
        </div>
        </>
    );
};

export default Profile;