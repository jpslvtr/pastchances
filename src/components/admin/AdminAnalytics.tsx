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
}

const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ analytics, classDisplayName }) => {
    if (!analytics) {
        return (
            <div className="admin-loading">
                Loading {classDisplayName} analytics...
            </div>
        );
    }

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
                    <span className="class-stat">
                        <strong>{analytics.classParticipationRate}%</strong> class participation
                    </span>
                </div>
            </div>

            <div className="admin-quick-insights">
                <div className="admin-insight-card">
                    <h4>Platform Activity</h4>
                    <p>{analytics.usersWithCrushes} users have sent crushes</p>
                    <p>{analytics.usersWithMatches} users have matches</p>
                    <p>{analytics.avgCrushes} average crushes sent per user</p>
                    <p>{analytics.activeUsersLast24h}% users active in last 24h</p>
                </div>

                <div className="admin-insight-card">
                    <h4>Participation Metrics</h4>
                    <p>{analytics.participationRate}% of signed-up users active</p>
                    <p>{analytics.classParticipationRate}% of total class participating</p>
                    <p>{analytics.totalUsers}/{analytics.totalClassSize} students signed up</p>
                    <p>{analytics.inactiveReceivers.length} inactive receivers</p>
                </div>

                <div className="admin-insight-card">
                    <h4>Matching Success</h4>
                    <p>{analytics.totalMatches} total matches</p>
                    <p>{analytics.totalCrushes} total crushes sent</p>
                    <p>{analytics.peopleWithCrushes} people receiving crushes</p>
                    <p>{analytics.orphanedCrushes.length} orphaned crushes</p>
                </div>
            </div>

            <div className="admin-analytics">
                <div className="admin-analytics-section">
                    <h4>All {classDisplayName} Matches ({analytics.totalMatches})</h4>
                    {analytics.matchedPairs.length ? (
                        <div className="admin-matches-list">
                            {analytics.matchedPairs.map((pair, index) => (
                                <div key={index} className="admin-match-item">
                                    {index + 1}. {pair}
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

                {analytics.orphanedCrushes.length > 0 && (
                    <div className="admin-analytics-section">
                        <h4>{classDisplayName} Orphaned Crushes ({analytics.orphanedCrushes.length})</h4>
                        <div className="admin-list">
                            {analytics.orphanedCrushes.map((crush, index) => (
                                <div key={crush} className="admin-list-item">
                                    <span>{index + 1}. {crush}</span>
                                    <span>Not signed up</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminAnalytics;