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

        // Sort: timestamped matches first (most recent), then untimstamped (alphabetical)
        return matches.sort((a, b) => {
            const aHasTimestamp = !!a.timestamp;
            const bHasTimestamp = !!b.timestamp;

            if (aHasTimestamp && !bHasTimestamp) return -1;
            if (!aHasTimestamp && bHasTimestamp) return 1;

            if (aHasTimestamp && bHasTimestamp) {
                try {
                    const toDate = (ts: any): Date => {
                        if (typeof ts.toDate === 'function') return ts.toDate();
                        if (ts.seconds) return new Date(ts.seconds * 1000);
                        if (ts._seconds) return new Date(ts._seconds * 1000);
                        return new Date(ts);
                    };
                    return toDate(b.timestamp).getTime() - toDate(a.timestamp).getTime();
                } catch {
                    return 0;
                }
            }

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

                <div className="admin-analytics-section">
                    <h4>All {classDisplayName} Matches ({analytics.totalMatches})</h4>
                    {matchesWithTimestamps.length ? (
                        <div className="admin-list">
                            {matchesWithTimestamps.map((match, index) => (
                                <div key={index} className="admin-list-item">
                                    <span>{index + 1}. {match.pair}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p>No matches found yet in {classDisplayName} class.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminAnalytics;