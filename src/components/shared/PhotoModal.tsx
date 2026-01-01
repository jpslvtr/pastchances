import { useEffect } from 'react';
import '../../styles/photo-modal.css';

interface PhotoModalProps {
    photoUrl: string;
    userName: string;
    onClose: () => void;
}

const PhotoModal = ({ photoUrl, userName, onClose }: PhotoModalProps) => {
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [onClose]);

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="photo-modal-backdrop" onClick={handleBackdropClick}>
            <div className="photo-modal-content">
                <button className="photo-modal-close" onClick={onClose} aria-label="Close">
                    ×
                </button>
                <img
                    src={photoUrl}
                    alt={userName}
                    className="photo-modal-image"
                />
            </div>
        </div>
    );
};

export default PhotoModal;