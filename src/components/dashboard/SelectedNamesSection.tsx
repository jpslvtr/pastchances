import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import UserPhoto from '../shared/UserPhoto';

interface SelectedNamesSectionProps {
    selectedNames: string[];
    savedNames: string[];
    lockedCrushes: string[];
    matches: Array<{ name: string; email: string }>;
    onRemove: (name: string) => void;
    userClass: string;
}

interface UserPhotoData {
    name: string;
    customPhotoURL?: string;
}

const SelectedNamesSection = ({
    selectedNames,
    savedNames,
    lockedCrushes,
    matches,
    onRemove,
    userClass
}: SelectedNamesSectionProps) => {
    const [photoCache, setPhotoCache] = useState<Map<string, string>>(new Map());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadPhotos = async () => {
            if (selectedNames.length === 0) {
                setLoading(false);
                return;
            }

            try {
                const usersRef = collection(db, 'users');
                const snapshot = await getDocs(usersRef);

                const cache = new Map<string, string>();
                snapshot.forEach(doc => {
                    const data = doc.data() as UserPhotoData;
                    if (data.customPhotoURL) {
                        cache.set(data.name, data.customPhotoURL);
                    }
                });

                setPhotoCache(cache);
            } catch (error) {
                console.error('Error loading photos:', error);
            } finally {
                setLoading(false);
            }
        };

        loadPhotos();
    }, [selectedNames]);

    const hasUnsavedChanges = JSON.stringify([...selectedNames].sort()) !== JSON.stringify([...savedNames].sort());
    const matchedNames = new Set(matches.map(m => m.name));

    const handleRemoveClick = (name: string) => {
        if (lockedCrushes.includes(name)) {
            return;
        }
        onRemove(name);
    };

    if (loading) {
        return (
            <div className="selected-section">
                <h3>Your Selections ({selectedNames.length})</h3>
                <div className="classmates-list">
                    <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                        Loading...
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="selected-section">
            <h3>Your Selections ({selectedNames.length})</h3>

            {selectedNames.length === 0 ? (
                <div className="classmates-list">
                    <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                        No selections yet. Add classmates from below.
                    </div>
                </div>
            ) : (
                <div className="classmates-list">
                    {selectedNames.map((name) => {
                        const isLocked = lockedCrushes.includes(name);
                        const isMatched = matchedNames.has(name);
                        const photoURL = photoCache.get(name);

                        return (
                            <div
                                key={name}
                                className="classmate-item"
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                    <UserPhoto
                                        name={name}
                                        userClass={userClass}
                                        size="small"
                                        photoUrl={photoURL}
                                    />
                                    <span style={{
                                        flex: 1,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {name}
                                    </span>
                                </div>

                                {isLocked ? (
                                    <button
                                        className="action-btn locked"
                                        disabled
                                        title={isMatched ? "Matched!" : "Locked"}
                                    >
                                        🔒
                                    </button>
                                ) : (
                                    <button
                                        className="action-btn remove"
                                        onClick={() => handleRemoveClick(name)}
                                        title="Remove"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {hasUnsavedChanges && selectedNames.length > 0 && (
                <div style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    background: '#fff3cd',
                    border: '1px solid #ffc107',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#856404'
                }}>
                    You have unsaved changes. Click "Update Preferences" to save.
                </div>
            )}
        </div>
    );
};

export default SelectedNamesSection;