import { useState, useEffect } from 'react';
import { getUserPhoto, getPhotoUrl, getInitials, generateInitialsColor } from '../../utils/photoUtils';

interface UserPhotoProps {
    name: string;
    userClass?: string;
    size?: 'small' | 'medium' | 'large';
    className?: string;
    photoUrl?: string | null | undefined; // Pre-loaded photo URL to skip database query
}

const UserPhoto = ({ name, userClass = 'gsb', size = 'small', className = '', photoUrl: propsPhotoUrl }: UserPhotoProps) => {
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // If photo URL is provided as prop, use it immediately
        if (propsPhotoUrl !== undefined) {
            setPhotoUrl(propsPhotoUrl);
            setLoading(false);
            return;
        }

        // Otherwise, fetch from database
        let mounted = true;

        const loadPhoto = async () => {
            setLoading(true);
            const userPhoto = await getUserPhoto(name, userClass);
            const url = getPhotoUrl(userPhoto);

            if (mounted) {
                setPhotoUrl(url);
                setLoading(false);
            }
        };

        loadPhoto();

        return () => {
            mounted = false;
        };
    }, [name, userClass, propsPhotoUrl]);

    const initials = getInitials(name);
    const bgColor = generateInitialsColor(name);
    const sizeClass = `user-photo-${size}`;

    if (loading) {
        return (
            <div className={`user-photo ${sizeClass} user-photo-loading ${className}`}>
                <div className="user-photo-spinner"></div>
            </div>
        );
    }

    // Show actual photo if it exists (only real uploaded photos)
    if (photoUrl) {
        return (
            <img
                src={photoUrl}
                alt={name}
                className={`user-photo ${sizeClass} ${className}`}
            />
        );
    }

    // Show initials for: no photo, default silhouettes, Google-generated initials
    return (
        <div
            className={`user-photo ${sizeClass} user-photo-initials ${className}`}
            style={{ backgroundColor: bgColor }}
        >
            {initials}
        </div>
    );
};

export default UserPhoto;