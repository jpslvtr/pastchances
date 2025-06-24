import React from 'react';

interface LoadingSpinnerProps {
    message?: string;
    className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    message = 'Loading...',
    className = 'loading'
}) => (
    <div className={className}>
        {message}
    </div>
);