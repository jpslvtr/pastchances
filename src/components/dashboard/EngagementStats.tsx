import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { UserData } from '../../types';
import '../../styles/dashboard/engagement-stats.css';

export const EngagementStats: React.FC = () => {
    const [totalMatches, setTotalMatches] = useState<number>(0);
    const [totalCrushes, setTotalCrushes] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Real-time listener for GSB users only
        const usersRef = collection(db, 'users');
        const gsbQuery = query(usersRef, where('userClass', '==', 'gsb'));

        const unsubscribe = onSnapshot(gsbQuery, (snapshot) => {
            let crushCount = 0;
            const matchPairs = new Set<string>();

            snapshot.forEach((doc) => {
                const userData = doc.data() as UserData;

                // Count unique match pairs (not instances)
                if (userData.matches && Array.isArray(userData.matches)) {
                    userData.matches.forEach(match => {
                        const matchName = match.name || match;
                        // Create a normalized pair key (alphabetically sorted to avoid duplicates)
                        const pair = [userData.name, matchName].sort().join(' ↔ ');
                        matchPairs.add(pair);
                    });
                }

                // Count total crushes sent
                if (userData.crushes && Array.isArray(userData.crushes)) {
                    crushCount += userData.crushes.length;
                }
            });

            setTotalMatches(matchPairs.size);
            setTotalCrushes(crushCount);
            setLoading(false);
        }, (error) => {
            console.error('Error listening to engagement stats:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="engagement-stats">
                <div className="stat-item">
                    <span className="stat-value">...</span>
                    <span className="stat-label">matches made</span>
                </div>
                <div className="stat-divider">•</div>
                <div className="stat-item">
                    <span className="stat-value">...</span>
                    <span className="stat-label">crushes sent</span>
                </div>
            </div>
        );
    }

    return (
        <div className="engagement-stats">
            <div className="stat-item">
                <span className="stat-value">{totalMatches.toLocaleString()}</span>
                <span className="stat-label">matches made</span>
            </div>
            <div className="stat-divider">•</div>
            <div className="stat-item">
                <span className="stat-value">{totalCrushes.toLocaleString()}</span>
                <span className="stat-label">crushes sent</span>
            </div>
        </div>
    );
};