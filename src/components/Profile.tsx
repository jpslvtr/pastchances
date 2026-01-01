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
    const [showCropModal, setShowCropModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);

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

    const resizeImageIfNeeded = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            // If file is already under 5MB, just use it directly
            if (file.size < 5 * 1024 * 1024) {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
                return;
            }

            // File is too large, resize it
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

                    // Calculate new dimensions to reduce file size
                    // Target max dimension of 2048px which usually results in <5MB
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

    const handlePhotoSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        try {
            // Resize image if needed and load for cropping
            const resizedDataUrl = await resizeImageIfNeeded(file);
            setSelectedImage(resizedDataUrl);
            setImageFile(file);
            setZoom(1);
            setPosition({ x: 0, y: 0 });
            setShowCropModal(true);
        } catch (error) {
            console.error('Error loading image:', error);
            alert('Failed to load image. Please try again.');
        }
    };

    const handleCropCancel = () => {
        setShowCropModal(false);
        setSelectedImage(null);
        setImageFile(null);
        setZoom(1);
        setPosition({ x: 0, y: 0 });
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

    const getCroppedImage = (): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const canvas = canvasRef.current;
            const image = imageRef.current;

            if (!canvas || !image) {
                reject(new Error('Canvas or image not ready'));
                return;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }

            // Set canvas size to desired output (400x400 for profile photos)
            const outputSize = 400;
            canvas.width = outputSize;
            canvas.height = outputSize;

            // Get the natural dimensions of the image
            const imgWidth = image.naturalWidth;
            const imgHeight = image.naturalHeight;

            // Calculate the size the image should be to fill the preview circle
            // The preview circle is 300px, so we need to scale accordingly
            const previewSize = 300;
            const scale = Math.max(previewSize / imgWidth, previewSize / imgHeight);

            // Apply zoom on top of the base scale
            const totalScale = scale * zoom;

            // Calculate scaled dimensions
            const scaledWidth = imgWidth * totalScale;
            const scaledHeight = imgHeight * totalScale;

            // Apply position offset (scaled to output size)
            const scaleRatio = outputSize / previewSize;
            const x = (outputSize - scaledWidth) / 2 + (position.x * scaleRatio);
            const y = (outputSize - scaledHeight) / 2 + (position.y * scaleRatio);

            // Fill with white background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, outputSize, outputSize);

            // Draw the image with the same transformation as the preview
            ctx.drawImage(image, x, y, scaledWidth, scaledHeight);

            // Convert to blob
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Failed to create blob'));
                }
            }, 'image/jpeg', 0.9);
        });
    };

    const handleCropConfirm = async () => {
        if (!user || !userData || !imageFile) return;

        setUploadingPhoto(true);
        try {
            // Get cropped image
            const croppedBlob = await getCroppedImage();

            const actualUid = getUserDocumentId(user, userData);

            // Delete old custom photo if exists
            if (userData.customPhotoURL) {
                try {
                    const oldPhotoRef = ref(storage, `profile-photos/${actualUid}`);
                    await deleteObject(oldPhotoRef);
                } catch (error) {
                    console.log('No previous photo to delete or deletion failed');
                }
            }

            // Upload new photo
            const storageRef = ref(storage, `profile-photos/${actualUid}`);
            await uploadBytes(storageRef, croppedBlob);
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

            handleCropCancel();
        } catch (error) {
            console.error('Error uploading photo:', error);
            alert('Failed to upload photo. Please try again.');
            setUploadingPhoto(false);
        } finally {
            setUploadingPhoto(false);
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
                `limit=8&` +
                `addressdetails=1`,
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
                // Try to build a meaningful location string
                const city = item.address?.city ||
                    item.address?.town ||
                    item.address?.village ||
                    item.address?.hamlet || '';
                const state = item.address?.state || '';
                const country = item.address?.country || '';

                let formatted = '';

                if (city && state) {
                    // US-style: City, State
                    formatted = `${city}, ${state}`;
                } else if (city && country) {
                    // International: City, Country
                    formatted = `${city}, ${country}`;
                } else if (state && country) {
                    // State/Region, Country
                    formatted = `${state}, ${country}`;
                } else if (country) {
                    // Just country
                    formatted = country;
                }

                if (formatted) {
                    uniqueSuggestions.set(formatted, true);
                }
            });

            setSuggestions(Array.from(uniqueSuggestions.keys()).slice(0, 8));
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
                        </div>
                        <h2 className="profile-name">{userData?.name || user?.displayName}</h2>
                    </div>

                    <div className="info-divider"></div>


                    <div className="profile-info-section">
                        <h3>Public Profile</h3>
                        <br></br>
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

                        <div className="info-divider"></div>

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
                    </div>
                </div>
            </div>

            {showCropModal && selectedImage && (
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
        </div>
    );
};

export default Profile;