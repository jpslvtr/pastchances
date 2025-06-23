import React from 'react';

interface CrusherInfo {
    name: string;
    email: string;
}

interface AnalyticsData {
    totalUsers: number;
    totalClassSize: number;
    totalMatches: number;
    matchedPairs: string[];
    totalCrushes: number;
    peopleWithCrushes: number;
    avgCrushes: number;
    usersWithCrushes: number;
    usersWithMatches: number;
    participationRate: number;
    classParticipationRate: number;
    orphanedCrushes: string[];
    topCrushReceivers: Array<{ name: string; count: number; crushers: string[] }>;
    topCrushSenders: Array<{ name: string; count: number; crushNames: string[] }>;
    inactiveReceivers: Array<{ name: string; email: string; crushCount: number; reason: string; crushers: CrusherInfo[] }>;
    activeUsersLast24h: number;
}

interface AdminAnalyticsProps {
    analytics: AnalyticsData | null;
    classView: 'gsb' | 'undergrad';
    classDisplayName: string;
    allUsers: any[];
}

// Enhanced helper function to format match timestamp for analytics
const formatAnalyticsMatchTimestamp = (matchedAt: any): string => {
    if (!matchedAt) {
        return 'No timestamp';
    }

    let date: Date;

    try {
        // Handle Firestore Timestamp with seconds property
        if (matchedAt && typeof matchedAt === 'object' && matchedAt.seconds) {
            date = new Date(matchedAt.seconds * 1000);
        }
        // Handle Firestore Timestamp with toDate method
        else if (matchedAt && typeof matchedAt.toDate === 'function') {
            date = matchedAt.toDate();
        }
        // Handle regular Date object
        else if (matchedAt instanceof Date) {
            date = matchedAt;
        }
        // Handle string or number timestamps
        else if (typeof matchedAt === 'string' || typeof matchedAt === 'number') {
            date = new Date(matchedAt);
        }
        // Handle the _seconds format from debug output
        else if (matchedAt && matchedAt._seconds) {
            date = new Date(matchedAt._seconds * 1000);
        }
        else {
            console.log('Unknown timestamp format:', matchedAt);
            return 'Unknown format';
        }

        // Validate the date
        if (isNaN(date.getTime())) {
            console.log('Invalid date created from:', matchedAt);
            return 'Invalid Date';
        }

        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) {
            return 'Just now';
        } else if (diffInSeconds < 3600) {
            const minutes = Math.floor(diffInSeconds / 60);
            return `${minutes}m ago`;
        } else if (diffInSeconds < 86400) {
            const hours = Math.floor(diffInSeconds / 3600);
            return `${hours}h ago`;
        } else if (diffInSeconds < 604800) {
            const days = Math.floor(diffInSeconds / 86400);
            return `${days}d ago`;
        } else {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            });
        }
    } catch (error) {
        console.error('Error formatting timestamp:', error, 'Original value:', matchedAt);
        return 'Format Error';
    }
};

const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ analytics, classDisplayName, allUsers }) => {
    if (!analytics) {
        return (
            <div className="admin-loading">
                Loading {classDisplayName} analytics...
            </div>
        );
    }

    // Get all matches with timestamps from users in this class
    const getAllMatchesWithTimestamps = () => {
        const matches: Array<{ pair: string; timestamp: any; users: string[] }> = [];
        const seenPairs = new Set<string>();

        allUsers.forEach(user => {
            if (user.matches && user.matches.length > 0) {
                user.matches.forEach((match: any) => {
                    const pair = [user.name, match.name].sort().join(' ↔ ');
                    if (!seenPairs.has(pair)) {
                        seenPairs.add(pair);
                        matches.push({
                            pair,
                            timestamp: match.matchedAt,
                            users: [user.name, match.name]
                        });
                    }
                });
            }
        });

        // Sort matches: those with timestamps first (by most recent), then those without
        return matches.sort((a, b) => {
            const aHasTimestamp = !!a.timestamp;
            const bHasTimestamp = !!b.timestamp;

            // If one has timestamp and other doesn't, prioritize the one with timestamp
            if (aHasTimestamp && !bHasTimestamp) return -1;
            if (!aHasTimestamp && bHasTimestamp) return 1;

            // If both have timestamps, sort by most recent first
            if (aHasTimestamp && bHasTimestamp) {
                try {
                    let dateA: Date, dateB: Date;

                    // Handle different timestamp formats for sorting
                    if (a.timestamp && a.timestamp.seconds) {
                        dateA = new Date(a.timestamp.seconds * 1000);
                    } else if (a.timestamp && a.timestamp._seconds) {
                        dateA = new Date(a.timestamp._seconds * 1000);
                    } else if (a.timestamp && typeof a.timestamp.toDate === 'function') {
                        dateA = a.timestamp.toDate();
                    } else {
                        dateA = new Date(a.timestamp);
                    }

                    if (b.timestamp && b.timestamp.seconds) {
                        dateB = new Date(b.timestamp.seconds * 1000);
                    } else if (b.timestamp && b.timestamp._seconds) {
                        dateB = new Date(b.timestamp._seconds * 1000);
                    } else if (b.timestamp && typeof b.timestamp.toDate === 'function') {
                        dateB = b.timestamp.toDate();
                    } else {
                        dateB = new Date(b.timestamp);
                    }

                    return dateB.getTime() - dateA.getTime();
                } catch (error) {
                    console.error('Error sorting timestamps:', error);
                    return 0;
                }
            }

            // If neither has timestamp, sort alphabetically
            return a.pair.localeCompare(b.pair);
        });
    };

    const matchesWithTimestamps = getAllMatchesWithTimestamps();

    return (
        <div className="admin-overview">
            <div className="admin-class-header">
                <h4>{classDisplayName} Class of 2025 - Analytics Dashboard</h4>
                <div className="admin-class-stats-summary">
                    <span className="class-stat">
                        <strong>{analytics.totalUsers}</strong> active users
                    </span>
                    <span className="class-stat">
                        <strong>{analytics.totalClassSize}</strong> total class size
                    </span>
                </div>
            </div>

            <div className="admin-quick-insights">
                <div className="admin-insight-card">
                    <h4>Platform Activity</h4>
                    <p>{analytics.usersWithCrushes} users have sent crushes</p>
                    <p>{analytics.usersWithMatches} users have matches</p>
                    <p>{analytics.avgCrushes} average crushes sent per user</p>
                    <p>{analytics.activeUsersLast24h}% of active users logged in (last 24h)</p>
                </div>

                <div className="admin-insight-card">
                    <h4>Participation Metrics</h4>
                    <p>{analytics.participationRate}% of signed-up users active</p>
                    <p>{analytics.inactiveReceivers.length} inactive receivers</p>
                </div>

                <div className="admin-insight-card">
                    <h4>Matching Success</h4>
                    <p>{analytics.totalMatches} total matches</p>
                    <p>{analytics.totalCrushes} total crushes sent</p>
                    <p>{analytics.peopleWithCrushes} people receiving crushes</p>
                </div>
            </div>

            <div className="admin-analytics">
                <div className="admin-analytics-section">
                    <h4>All {classDisplayName} Matches ({analytics.totalMatches}) - With Timestamps</h4>
                    {matchesWithTimestamps.length ? (
                        <div className="admin-matches-list">
                            {matchesWithTimestamps.map((match, index) => (
                                <div key={index} className="admin-match-item-with-timestamp">
                                    <div className="admin-match-pair">
                                        {index + 1}. {match.pair}
                                    </div>
                                    <div className="admin-match-time">
                                        {formatAnalyticsMatchTimestamp(match.timestamp)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p>No matches found yet in {classDisplayName} class.</p>
                    )}
                </div>

                <div className="admin-analytics-section">
                    <h4>Top {classDisplayName} Crush Receivers</h4>
                    <div className="admin-list">
                        {analytics.topCrushReceivers.slice(0, 15).map((receiver, index) => (
                            <div key={receiver.name} className="admin-list-item">
                                <span>{index + 1}. {receiver.name}</span>
                                <span>{receiver.count} crushes</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="admin-analytics-section">
                    <h4>Top {classDisplayName} Crush Senders</h4>
                    <div className="admin-list">
                        {analytics.topCrushSenders.slice(0, 15).map((sender, index) => (
                            <div key={sender.name} className="admin-list-item">
                                <span>{index + 1}. {sender.name}</span>
                                <span>{sender.count} crushes sent</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="admin-analytics-section">
                    <h4>{classDisplayName} Inactive Receivers ({analytics.inactiveReceivers.length})</h4>
                    <div className="admin-list">
                        {analytics.inactiveReceivers.map((inactive, index) => (
                            <div key={inactive.email} className="admin-inactive-item">
                                <div className="admin-inactive-header">
                                    <span>{index + 1}. {inactive.name}</span>
                                    <span>{inactive.crushCount} crushes</span>
                                </div>
                                <div className="admin-inactive-details">
                                    <p>Email: {inactive.email}</p>
                                    <p>Reason: {inactive.reason}</p>
                                    <p>Crushers: {inactive.crushers.map(c => c.name).join(', ')}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminAnalytics;