import React, { useRef } from 'react';

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    className?: string;
    onClear?: () => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({
    value,
    onChange,
    placeholder,
    className = 'search-input',
    onClear
}) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleClear = () => {
        onChange('');
        if (onClear) onClear();
        if (inputRef.current) {
            inputRef.current.focus();
        }
    };

    return (
        <div className="search-input-container">
            <input
                ref={inputRef}
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={className}
            />
            {value && (
                <button
                    onClick={handleClear}
                    className="search-clear-btn"
                    type="button"
                    aria-label="Clear search"
                >
                    ×
                </button>
            )}
        </div>
    );
};