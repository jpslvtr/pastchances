import React from 'react';
import { GSB_CLASS_NAMES } from '../data/names';
import { UNDERGRAD_CLASS_NAMES } from '../data/names-undergrad';
import type { UserData } from '../types/userTypes';

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

// Enhanced name matching function
const matchesSearchTerm = (fullName: string, searchTerm: string): { matches: boolean; score: number } => {
    if (!searchTerm.trim()) return { matches: true, score: 0 };

    const normalizeText = (text: string) => text.toLowerCase().trim().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ');

    const normalizedName = normalizeText(fullName);
    const normalizedSearch = normalizeText(searchTerm);

    // Simple substring match (highest priority)
    if (normalizedName.includes(normalizedSearch)) {
        return { matches: true, score: 100 };
    }

    const nameParts = normalizedName.split(' ').filter(Boolean);
    const searchParts = normalizedSearch.split(' ').filter(Boolean);

    // Check if all search parts match the beginning of name parts
    if (searchParts.every(searchPart =>
        nameParts.some(namePart => namePart.startsWith(searchPart))
    )) {
        return { matches: true, score: 90 };
    }

    // Check if search parts match name parts in order (allows for middle names)
    let nameIndex = 0;
    let matchedParts = 0;

    for (const searchPart of searchParts) {
        let found = false;
        for (let i = nameIndex; i < nameParts.length; i++) {
            if (nameParts[i].startsWith(searchPart)) {
                matchedParts++;
                nameIndex = i + 1;
                found = true;
                break;
            }
        }
        if (!found) break;
    }

    if (matchedParts === searchParts.length) {
        return { matches: true, score: 80 };
    }

    // Fuzzy matching - check if most characters match
    const searchChars = normalizedSearch.replace(/\s/g, '');
    const nameChars = normalizedName.replace(/\s/g, '');

    let matchCount = 0;
    let searchIndex = 0;

    for (let i = 0; i < nameChars.length && searchIndex < searchChars.length; i++) {
        if (nameChars[i] === searchChars[searchIndex]) {
            matchCount++;
            searchIndex++;
        }
    }

    const fuzzyScore = (matchCount / searchChars.length) * 100;

    if (fuzzyScore >= 70) {
        return { matches: true, score: fuzzyScore };
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
    const [debouncedSearchTerm, setDebouncedSearchTerm] = React.useState('');
    const [virtualStart, setVirtualStart] = React.useState(0);
    const searchInputRef = React.useRef<HTMLInputElement>(null);

    const hasMatches = userData?.matches && userData.matches.length > 0;
    const crushCount = userData?.crushCount || 0;
    const lockedCrushes = userData?.lockedCrushes || [];
    const hasUnsavedChanges = JSON.stringify(selectedNames.sort()) !== JSON.stringify(savedNames.sort());

    // Get the appropriate class names based on user's class
    const classNames = userData?.userClass === 'gsb' ? GSB_CLASS_NAMES : UNDERGRAD_CLASS_NAMES;
    const classDisplayName = userData?.userClass === 'gsb' ? 'GSB MBA' : 'Undergraduate';

    // Debounce search term for better performance
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            setVirtualStart(0); // Reset virtual scroll when search changes
        }, 300);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Handle search input change
    const handleSearchChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    }, [setSearchTerm]);

    // Enhanced filtering with fuzzy name matching and memoization
    const filteredAvailableNames = React.useMemo(() => {
        const excludedNames = [...selectedNames];

        if (userData?.name) {
            excludedNames.push(userData.name);
        }

        const availableNames = classNames.filter(name => !excludedNames.includes(name));

        if (!debouncedSearchTerm.trim()) return availableNames;

        // Apply fuzzy matching and sort by relevance score
        const matchedNames = availableNames
            .map(name => {
                const result = matchesSearchTerm(name, debouncedSearchTerm);
                return { name, ...result };
            })
            .filter(item => item.matches)
            .sort((a, b) => b.score - a.score)
            .map(item => item.name);

        return matchedNames;
    }, [selectedNames, debouncedSearchTerm, userData?.name, classNames]);

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
        setDebouncedSearchTerm('');
        setVirtualStart(0);
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [setSearchTerm]);

    // Highlight matching parts of names for better UX
    const highlightMatch = React.useCallback((name: string, searchTerm: string) => {
        if (!searchTerm.trim()) return name;

        const normalizeText = (text: string) => text.toLowerCase().trim();
        const normalizedName = normalizeText(name);
        const normalizedSearch = normalizeText(searchTerm);

        // Simple highlighting for exact substring matches
        const index = normalizedName.indexOf(normalizedSearch);
        if (index !== -1) {
            const before = name.substring(0, index);
            const match = name.substring(index, index + searchTerm.length);
            const after = name.substring(index + searchTerm.length);

            return (
                <>
                    {before}
                    <span className="search-highlight">{match}</span>
                    {after}
                </>
            );
        }

        return name;
    }, []);

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
                        {userData.matches.map((match, index) => (
                            <div key={index} className="match-item">
                                <div className="match-name">{match.name}</div>
                                <div className="match-email">{match.email}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="header-section">
                <div className="class-indicator">
                    <span className="class-badge">{classDisplayName} Class of 2025</span>
                </div>
                <div className="instructions">
                    <ol>
                        <li>Select any classmates you'd like to connect with. Your selections are completely private - only you can see who you've chosen.</li>
                        <li>Click "Update Preferences" to save your changes. Matches appear automatically when someone you've selected also selects you. Matches are completely private.</li>
                        <li>You can add or remove names anytime. There's no limit on how many people you can select, and you can change your preferences as often as you want.</li>
                        <li>Once you match with someone, you cannot remove them from your list.</li>
                    </ol>
                </div>
            </div>

            <div className="selection-counter">
                {selectedNames.length} selected
                {hasUnsavedChanges && <span className="unsaved-badge">UNSAVED CHANGES</span>}
            </div>

            {selectedNames.length > 0 && (
                <div className="selected-names">
                    <h3>Your Selections ({selectedNames.length})</h3>
                    <div className="name-chips">
                        {selectedNames.map(name => {
                            const isLocked = lockedCrushes.includes(name);
                            return (
                                <div key={name} className={`name-chip ${isLocked ? 'locked' : 'selected'}`}>
                                    <span>{name}</span>
                                    {isLocked ? (
                                        <span className="lock-icon" title="Locked - you have matched with this person">🔒</span>
                                    ) : (
                                        <button
                                            onClick={() => handleRemoveSelected(name)}
                                            className="remove-btn"
                                            aria-label={`Remove ${name}`}
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
            )}

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
                {debouncedSearchTerm && debouncedSearchTerm !== searchTerm && (
                    <div className="search-loading">Searching...</div>
                )}
                {debouncedSearchTerm && filteredAvailableNames.length > 0 && (
                    <div className="search-hint">
                        💡 Results sorted by relevance. Try searching by first and last name for better results.
                    </div>
                )}
            </div>

            <div className="available-names">
                <h3>
                    Classmates
                    {debouncedSearchTerm && ` (${filteredAvailableNames.length} found)`}
                    {!debouncedSearchTerm && ` (${filteredAvailableNames.length} available)`}
                </h3>
                <div
                    className="names-simple-list"
                    onScroll={handleScroll}
                    style={{ height: `${VISIBLE_ITEMS * ITEM_HEIGHT}px` }}
                >
                    {/* Spacer for items before visible range */}
                    {startIndex > 0 && (
                        <div style={{ height: `${startIndex * ITEM_HEIGHT}px` }} />
                    )}

                    {visibleNames.map((name, index) => {
                        const actualIndex = startIndex + index;
                        return (
                            <div
                                key={`${name}-${actualIndex}`}
                                onClick={() => !updating && handleNameToggle(name)}
                                className={`name-list-item ${updating ? 'disabled' : ''}`}
                                style={{
                                    height: `${ITEM_HEIGHT}px`,
                                    minHeight: `${ITEM_HEIGHT}px`
                                }}
                            >
                                <span className="name-text">
                                    {highlightMatch(name, debouncedSearchTerm)}
                                </span>
                                <span className="add-btn">+</span>
                            </div>
                        );
                    })}

                    {/* Spacer for items after visible range */}
                    {endIndex < filteredAvailableNames.length && (
                        <div style={{ height: `${(filteredAvailableNames.length - endIndex) * ITEM_HEIGHT}px` }} />
                    )}

                    {filteredAvailableNames.length === 0 && (
                        <div className="no-results">
                            {debouncedSearchTerm ? (
                                <>
                                    No names found matching "{debouncedSearchTerm}".
                                    <br />
                                    <small>Try searching with just first and last name (e.g., "chloe walsh")</small>
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

            <div className="action-section">
                <div className="action-buttons">
                    <button
                        onClick={handleUpdatePreferences}
                        disabled={updating || !hasUnsavedChanges}
                        className="update-btn"
                    >
                        {updating ? 'Updating...' : 'Update Preferences'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="error-message" style={{ color: 'red', textAlign: 'center', marginTop: '15px' }}>
                    {error}
                </div>
            )}
        </>
    );
};

export default UserDashboard;