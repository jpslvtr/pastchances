import React from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { GSB_CLASS_NAMES } from '../data/names';
import { UNDERGRAD_CLASS_NAMES } from '../data/names-undergrad';
import type { UserData } from '../types/userTypes';
import UserPhoto from './shared/UserPhoto';

const SaveIcon = () => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
    >
        <path
            d="M12.5 2H3.5C2.67 2 2 2.67 2 3.5V12.5C2 13.33 2.67 14 3.5 14H12.5C13.33 14 14 13.33 14 12.5V3.5C14 2.67 13.33 2 12.5 2ZM11 6H9V11H7V6H5L8 3L11 6Z"
            fill="currentColor"
        />
    </svg>
);

interface UserDashboardProps {
    userData: UserData;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    selectedNames: string[];
    savedNames: string[];
    updating: boolean;
    error: string | null;
    handleNameToggle: (name: string) => void;
    handleRemoveSelected: (name: string) => void;
    handleUpdatePreferences: () => void;
}

// Simple hash function for generating consistent IDs from names
const hashName = (name: string): string => {
    let hash = 0;
    const normalized = name.toLowerCase().trim();
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
};

// Fast name matching function optimized for first/last name searches
const matchesSearchTerm = (fullName: string, searchTerm: string): { matches: boolean; score: number } => {
    if (!searchTerm.trim()) return { matches: true, score: 0 };

    const normalizeText = (text: string) => text.toLowerCase().trim();
    const normalizedName = normalizeText(fullName);
    const normalizedSearch = normalizeText(searchTerm);

    // Exact substring match (highest priority)
    if (normalizedName.includes(normalizedSearch)) {
        return { matches: true, score: 100 };
    }

    const nameParts = normalizedName.split(' ').filter(Boolean);
    const searchParts = normalizedSearch.split(' ').filter(Boolean);

    // First + Last name matching (most common use case)
    if (searchParts.length >= 2) {
        const searchFirst = searchParts[0];
        const searchLast = searchParts[searchParts.length - 1];

        if (nameParts.length >= 2) {
            const nameFirst = nameParts[0];
            const nameLast = nameParts[nameParts.length - 1];

            // Exact first + last match
            if (nameFirst === searchFirst && nameLast === searchLast) {
                return { matches: true, score: 95 };
            }

            // Partial first + exact last
            if (nameFirst.startsWith(searchFirst) && nameLast === searchLast) {
                return { matches: true, score: 90 };
            }

            // Exact first + partial last
            if (nameFirst === searchFirst && nameLast.startsWith(searchLast)) {
                return { matches: true, score: 85 };
            }
        }
    }

    // Single term matching
    if (searchParts.length === 1) {
        const searchTerm = searchParts[0];

        // Check if any name part starts with search term
        if (nameParts.some(part => part.startsWith(searchTerm))) {
            return { matches: true, score: 80 };
        }
    }

    // Multi-word progressive matching
    let nameIndex = 0;
    let matchedParts = 0;

    for (const searchPart of searchParts) {
        for (let i = nameIndex; i < nameParts.length; i++) {
            if (nameParts[i].startsWith(searchPart)) {
                matchedParts++;
                nameIndex = i + 1;
                break;
            }
        }
    }

    if (matchedParts === searchParts.length) {
        return { matches: true, score: 75 };
    }

    return { matches: false, score: 0 };
};

const UserDashboard: React.FC<UserDashboardProps> = ({
    userData,
    searchTerm,
    setSearchTerm,
    selectedNames,
    savedNames,
    updating,
    error,
    handleNameToggle,
    handleRemoveSelected,
    handleUpdatePreferences
}) => {
    const navigate = useNavigate();
    const [virtualStart, setVirtualStart] = React.useState(0);
    const searchInputRef = React.useRef<HTMLInputElement>(null);
    const [photoCache, setPhotoCache] = React.useState<Map<string, string | null>>(new Map());

    const hasMatches = userData?.matches && userData.matches.length > 0;
    const crushCount = userData?.crushCount || 0;
    const lockedCrushes = userData?.lockedCrushes || [];
    const matches = userData?.matches || [];

    // Ensure arrays are defined before using sort
    const safeSelectedNames = selectedNames || [];
    const safeSavedNames = savedNames || [];
    const hasUnsavedChanges = JSON.stringify([...safeSelectedNames].sort()) !== JSON.stringify([...safeSavedNames].sort());

    // Get the appropriate class names based on user's class
    const classNames = userData?.userClass === 'gsb' ? GSB_CLASS_NAMES : UNDERGRAD_CLASS_NAMES;
    const classDisplayName = userData?.userClass === 'gsb' ? 'GSB MBA' : 'Undergraduate';

    // Batch load all photos on mount
    React.useEffect(() => {
        let mounted = true;

        const loadAllPhotos = async () => {
            try {
                // Fetch all users with customPhotoURL
                const usersRef = collection(db, 'users');
                const q = query(
                    usersRef,
                    where('userClass', '==', userData.userClass)
                );

                const snapshot = await getDocs(q);
                const photoMap = new Map<string, string | null>();

                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.name && data.customPhotoURL) {
                        photoMap.set(data.name, data.customPhotoURL);
                    }
                });

                if (mounted) {
                    setPhotoCache(photoMap);
                }
            } catch (error) {
                console.error('Error loading photos:', error);
            }
        };

        loadAllPhotos();

        return () => {
            mounted = false;
        };
    }, [userData.userClass]);

    // Handle search input change
    const handleSearchChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setVirtualStart(0); // Reset scroll when search changes
    }, [setSearchTerm]);

    // Fast filtering with optimized name matching
    const filteredAvailableNames = React.useMemo(() => {
        const excludedNames = [...safeSelectedNames];

        if (userData?.name) {
            excludedNames.push(userData.name);
        }

        const availableNames = classNames.filter(name => !excludedNames.includes(name));

        if (!searchTerm.trim()) return availableNames;

        // Apply fast matching and sort by relevance score
        const matchedNames = availableNames
            .map(name => {
                const result = matchesSearchTerm(name, searchTerm);
                return { name, ...result };
            })
            .filter(item => item.matches)
            .sort((a, b) => b.score - a.score)
            .map(item => item.name);

        return matchedNames;
    }, [safeSelectedNames, searchTerm, userData?.name, classNames]);

    // Virtual scrolling constants
    const ITEM_HEIGHT = 48;
    const VISIBLE_ITEMS = Math.min(15, Math.max(8, Math.floor(window.innerHeight * 0.4 / ITEM_HEIGHT)));
    const BUFFER_SIZE = 5;

    // Calculate visible range for virtual scrolling
    const startIndex = Math.max(0, virtualStart - BUFFER_SIZE);
    const endIndex = Math.min(filteredAvailableNames.length, virtualStart + VISIBLE_ITEMS + BUFFER_SIZE);
    const visibleNames = filteredAvailableNames.slice(startIndex, endIndex);

    // Handle scroll for virtual scrolling
    const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const scrollTop = e.currentTarget.scrollTop;
        const newStart = Math.floor(scrollTop / ITEM_HEIGHT);

        if (Math.abs(newStart - virtualStart) > 2) {
            setVirtualStart(newStart);
        }
    }, [virtualStart]);

    // Clear search function
    const clearSearch = React.useCallback(() => {
        setSearchTerm('');
        setVirtualStart(0);
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [setSearchTerm]);

    // Simple function that just returns the name without highlighting
    const highlightMatch = React.useCallback((name: string, _searchTerm: string) => {
        return name;
    }, []);

    // Create set of matched names for quick lookup
    const matchedNames = new Set(matches.map((m: { name: string; email: string }) => m.name));

    // Navigate to profile using name hash
    const handleNavigateToProfile = React.useCallback((name: string) => {
        const nameHash = hashName(name);
        navigate(`/profile/${nameHash}`);
    }, [navigate]);

    // Handle match click
    const handleMatchClick = React.useCallback((match: { name: string; email: string }) => {
        const nameHash = hashName(match.name);
        navigate(`/profile/${nameHash}`);
    }, [navigate]);

    return (
        <>
            {crushCount > 0 && (
                <div className="crush-count-section">
                    <h2>{crushCount} {crushCount === 1 ? 'person is' : 'people are'} crushing on you!</h2>
                </div>
            )}

            {hasMatches && (
                <div className="matches-section">
                    <h2>🎉 You have {userData.matches.length} match{userData.matches.length > 1 ? 'es' : ''}!</h2>
                    <div className="matches-list">
                        {userData.matches.map((match: { name: string; email: string }, index: number) => (
                            <div
                                key={index}
                                className="match-item clickable"
                                onClick={() => handleMatchClick(match)}
                                style={{ cursor: 'pointer' }}
                            >
                                <UserPhoto
                                    name={match.name}
                                    userClass={userData.userClass}
                                    size="medium"
                                    photoUrl={photoCache.get(match.name)}
                                />
                                <div className="match-details">
                                    <div className="match-name">{match.name}</div>
                                    <div className="match-email">{match.email}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="selection-counter">
                {safeSelectedNames.length} selected
                {hasUnsavedChanges && <span className="unsaved-badge">UNSAVED CHANGES</span>}
            </div>

            {/* Memoize sorted selections outside of conditional */}
            {React.useMemo(() => {
                if (safeSelectedNames.length === 0) return null;

                const sortedSelections = [...safeSelectedNames].sort((a, b) => {
                    const aIsLocked = lockedCrushes.includes(a);
                    const bIsLocked = lockedCrushes.includes(b);
                    if (aIsLocked === bIsLocked) return 0;
                    return aIsLocked ? -1 : 1;
                });

                return (
                    <div className="selected-section">
                        <div className="selected-section-header">
                            <h3>Your Selections ({safeSelectedNames.length})</h3>
                            <button
                                onClick={handleUpdatePreferences}
                                disabled={!hasUnsavedChanges || updating}
                                className="update-btn-icon"
                                title={updating ? "Saving..." : "Save changes"}
                            >
                                {updating ? (
                                    <span className="spinner"></span>
                                ) : (
                                    <SaveIcon />
                                )}
                            </button>
                        </div>
                        <div className="names-simple-list selections-list">
                            {sortedSelections.map((name: string) => {
                                const isLocked = lockedCrushes.includes(name);
                                const photoURL = photoCache.get(name);

                                return (
                                    <div
                                        key={name}
                                        className="name-list-item"
                                        style={{
                                            height: `${ITEM_HEIGHT}px`,
                                            minHeight: `${ITEM_HEIGHT}px`
                                        }}
                                    >
                                        <div
                                            className="name-clickable-area"
                                            onClick={() => handleNavigateToProfile(name)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                flex: 1,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <UserPhoto
                                                name={name}
                                                userClass={userData.userClass}
                                                size="small"
                                                photoUrl={photoURL}
                                            />
                                            <span className="name-text">
                                                {name}
                                            </span>
                                        </div>

                                        {isLocked ? (
                                            <span
                                                className="lock-btn"
                                                title={matchedNames.has(name) ? "Matched!" : "Locked"}
                                            >
                                                🔒
                                            </span>
                                        ) : (
                                            <button
                                                className="remove-btn-icon"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemoveSelected(name);
                                                }}
                                                title="Remove"
                                                disabled={updating}
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            }, [safeSelectedNames, lockedCrushes, hasUnsavedChanges, updating, handleUpdatePreferences, handleRemoveSelected, photoCache, userData.userClass, matchedNames, ITEM_HEIGHT, handleNavigateToProfile])}

            <div className="search-section">
                <div className="search-input-container">
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder={`Search ${classDisplayName} classmates...`}
                        value={searchTerm}
                        onChange={handleSearchChange}
                        className="search-input"
                    />
                    {searchTerm && (
                        <button
                            onClick={clearSearch}
                            className="search-clear-btn"
                            type="button"
                            aria-label="Clear search"
                        >
                            ×
                        </button>
                    )}
                </div>
                {searchTerm && filteredAvailableNames.length > 0 && (
                    <div className="search-hint">
                        💡 {filteredAvailableNames.length} results found. Try "first last" for best results.
                    </div>
                )}
            </div>

            <div className="available-names">
                <div className="available-names-header">
                    <h3>
                        Classmates
                        {searchTerm && ` (${filteredAvailableNames.length} found)`}
                        {!searchTerm && ` (${filteredAvailableNames.length} available)`}
                    </h3>
                </div>
                <div
                    className="names-simple-list"
                    onScroll={handleScroll}
                    style={{ height: `${VISIBLE_ITEMS * ITEM_HEIGHT}px` }}
                >
                    {/* Spacer for items before visible range */}
                    {startIndex > 0 && (
                        <div style={{ height: `${startIndex * ITEM_HEIGHT}px` }} />
                    )}

                    {visibleNames.map((name: string, index: number) => {
                        const actualIndex = startIndex + index;
                        return (
                            <div
                                key={`${name}-${actualIndex}`}
                                className={`name-list-item ${updating ? 'disabled' : ''}`}
                                style={{
                                    height: `${ITEM_HEIGHT}px`,
                                    minHeight: `${ITEM_HEIGHT}px`
                                }}
                            >
                                <div
                                    className="name-clickable-area"
                                    onClick={() => !updating && handleNavigateToProfile(name)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        flex: 1,
                                        cursor: updating ? 'default' : 'pointer'
                                    }}
                                >
                                    <UserPhoto
                                        name={name}
                                        userClass={userData.userClass}
                                        size="small"
                                        photoUrl={photoCache.get(name)}
                                    />
                                    <span className="name-text">
                                        {highlightMatch(name, searchTerm)}
                                    </span>
                                </div>
                                <button
                                    className="add-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        !updating && handleNameToggle(name);
                                    }}
                                    disabled={updating}
                                    style={{ cursor: updating ? 'default' : 'pointer' }}
                                >
                                    +
                                </button>
                            </div>
                        );
                    })}

                    {/* Spacer for items after visible range */}
                    {endIndex < filteredAvailableNames.length && (
                        <div style={{ height: `${(filteredAvailableNames.length - endIndex) * ITEM_HEIGHT}px` }} />
                    )}

                    {filteredAvailableNames.length === 0 && (
                        <div className="no-results">
                            {searchTerm ? (
                                <>
                                    No names found matching "{searchTerm}".
                                    <br />
                                    <small>Try searching with just first and last name (e.g., "john smith")</small>
                                    <button onClick={clearSearch} className="clear-search-link">
                                        Clear search
                                    </button>
                                </>
                            ) : (
                                'All classmates have been selected!'
                            )}
                        </div>
                    )}
                </div>
            </div>

            {error && <div className="error-message">{error}</div>}
        </>
    );
};

export default UserDashboard;