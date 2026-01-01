import { useState, useEffect } from 'react';
import { getUserPhoto, getPhotoUrl, getInitials, generateInitialsColor } from '../../utils/photoUtils';

interface UserPhotoProps {
    name: string;
    userClass?: string;
    size?: 'small' | 'medium' | 'large';
    className?: string;
    photoUrl?: string | null | undefined;
    onClick?: (e: React.MouseEvent) => void;
}

const UserPhoto = ({ name, userClass = 'gsb', size = 'small', className = '', photoUrl: propsPhotoUrl, onClick }: UserPhotoProps) => {
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (propsPhotoUrl !== undefined) {
            setPhotoUrl(propsPhotoUrl);
            setLoading(false);
            return;
        }

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
    const clickableClass = onClick ? 'user-photo-clickable' : '';

    if (loading) {
        return (
            <div className={`user-photo ${sizeClass} user-photo-loading ${className}`}>
                <div className="user-photo-spinner"></div>
            </div>
        );
    }

    if (photoUrl) {
        return (
            <img
                src={photoUrl}
                alt={name}
                className={`user-photo ${sizeClass} ${clickableClass} ${className}`}
                onClick={onClick}
                style={{ cursor: onClick ? 'pointer' : 'default' }}
            />
        );
    }

    return (
        <div
            className={`user-photo ${sizeClass} user-photo-initials ${clickableClass} ${className}`}
            style={{ backgroundColor: bgColor, cursor: onClick ? 'pointer' : 'default' }}
            onClick={onClick}
        >
            {initials}
        </div>
    );
};

export default UserPhoto;