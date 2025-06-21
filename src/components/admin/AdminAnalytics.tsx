import React from 'react';

interface CrusherInfo {
    name: string;
    email: string;
}

interface AnalyticsData {
    totalUsers: number;
    totalTakenNames: number;
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
}

const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ analytics }) => {
    return (
        <div className="admin-overview">
            <div className="admin-quick-insights">
                <div className="admin-insight-card">
                    <h4>Platform Activity</h4>
                    <p>{analytics?.usersWithCrushes || 0} users have sent crushes</p>
                    <p>{analytics?.usersWithMatches || 0} users have matches</p>
                    <p>{analytics?.avgCrushes || 0} average crushes sent per user</p>
                    <p>{analytics?.activeUsersLast24h || 0}% users active in last 24h (real-time)</p>
                </div>
            </div>

            <div className="admin-analytics">
                <div className="admin-analytics-section">
                    <h4>All Matches ({analytics?.totalMatches || 0})</h4>
                    {analytics?.matchedPairs.length ? (
                        <div className="admin-matches-list">
                            {analytics.matchedPairs.map((pair, index) => (
                                <div key={index} className="admin-match-item">
                                    {index + 1}. {pair}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p>No matches found yet.</p>
                    )}
                </div>

                <div className="admin-analytics-section">
                    <h4>Top Crush Receivers</h4>
                    <div className="admin-list">
                        {analytics?.topCrushReceivers.map((receiver, index) => (
                            <div key={receiver.name} className="admin-list-item">
                                <span>{index + 1}. {receiver.name}</span>
                                <span>{receiver.count} crushes</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="admin-analytics-section">
                    <h4>Top Crush Senders</h4>
                    <div className="admin-list">
                        {analytics?.topCrushSenders.map((sender, index) => (
                            <div key={sender.name} className="admin-list-item">
                                <span>{index + 1}. {sender.name}</span>
                                <span>{sender.count} crushes sent</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="admin-analytics-section">
                    <h4>Inactive Receivers ({analytics?.inactiveReceivers.length || 0})</h4>
                    <div className="admin-list">
                        {analytics?.inactiveReceivers.map((inactive, index) => (
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