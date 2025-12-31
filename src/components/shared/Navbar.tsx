import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from 'firebase/auth';
import type { UserData } from '../../types/userTypes';
import { isAdminUser } from '../../utils/adminUtils';
import { signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../../config/firebase';

interface NavbarProps {
    user: User | null;
    userData: UserData | null;
    isAdminMode?: boolean;
    onAdminToggle?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({
    user,
    userData,
    isAdminMode = false,
    onAdminToggle
}) => {
    const navigate = useNavigate();
    const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const isAdmin = useMemo(() => {
        return isAdminUser(user, userData);
    }, [user, userData]);

    const getClassDisplayName = useMemo(() => {
        const userClass = userData?.userClass;
        return userClass === 'gsb' ? 'GSB MBA Class of 2025' : 'Undergrad Class of 2025';
    }, [userData?.userClass]);

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

    const handleLogoClick = useCallback(() => {
        if (window.location.pathname === '/') {
            window.location.reload();
        } else {
            navigate('/');
        }
    }, [navigate]);

    const handleLogout = useCallback(async () => {
        try {
            await firebaseSignOut(auth);
            navigate('/login');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    }, [navigate]);

    const currentImageUrl = getProfileImageUrl();

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };

        if (dropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [dropdownOpen]);

    return (
        <>
            <div className="dashboard-header">
                <div className="header-left" onClick={handleLogoClick} style={{ cursor: 'pointer' }}>
                    <img
                        src="/logo-rounded.png"
                        alt="Second Chances Logo"
                        className="header-logo"
                    />
                    <div className="header-title">
                        <h1>Second Chances</h1>
                    </div>
                </div>
                <div className="user-info">
                    <div className="profile-dropdown" ref={dropdownRef}>
                        <button
                            className="profile-dropdown-trigger"
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                        >
                            <img
                                src={currentImageUrl}
                                alt="Profile"
                                className="profile-pic"
                                onError={() => handleImageError(currentImageUrl)}
                                loading="lazy"
                            />
                            <span className="dropdown-arrow">▼</span>
                        </button>

                        {dropdownOpen && (
                            <div className="profile-dropdown-menu">
                                <button
                                    className="dropdown-item profile-item"
                                    onClick={() => {
                                        setDropdownOpen(false);
                                        navigate('/profile');
                                    }}
                                >
                                    <img
                                        src={currentImageUrl}
                                        alt="Profile"
                                        className="dropdown-profile-pic"
                                        onError={() => handleImageError(currentImageUrl)}
                                        loading="lazy"
                                    />
                                    <span>{userData?.name || 'Profile'}</span>
                                </button>

                                <div className="dropdown-divider"></div>

                                <button
                                    className="dropdown-item"
                                    onClick={() => {
                                        setDropdownOpen(false);
                                        navigate('/howto');
                                    }}
                                >
                                    How To
                                </button>

                                <button
                                    className="dropdown-item"
                                    onClick={() => {
                                        setDropdownOpen(false);
                                        navigate('/privacy');
                                    }}
                                >
                                    Privacy Policy
                                </button>

                                <button
                                    className="dropdown-item"
                                    onClick={() => {
                                        setDropdownOpen(false);
                                        navigate('/terms');
                                    }}
                                >
                                    Terms of Service
                                </button>

                                {isAdmin && (
                                    <>
                                        <div className="dropdown-divider"></div>
                                        <button
                                            className="dropdown-item"
                                            onClick={() => {
                                                setDropdownOpen(false);
                                                if (onAdminToggle) {
                                                    // On home page - toggle between modes
                                                    onAdminToggle();
                                                } else {
                                                    // On other pages - navigate to home with admin mode
                                                    navigate('/?admin=true');
                                                }
                                            }}
                                        >
                                            {onAdminToggle ? (isAdminMode ? 'User View' : 'Admin View') : 'Admin View'}
                                        </button>
                                    </>
                                )}

                                <div className="dropdown-divider"></div>

                                <button
                                    className="dropdown-item logout-item"
                                    onClick={() => {
                                        setDropdownOpen(false);
                                        handleLogout();
                                    }}
                                >
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="header-subtitle">{getClassDisplayName}</div>
        </>
    );
};

export default Navbar;