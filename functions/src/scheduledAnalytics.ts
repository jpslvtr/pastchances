import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const scheduledAnalytics = functions.pubsub
    .schedule('every 6 hours')
    .timeZone('America/Los_Angeles')
    .onRun(async (_context) => {
        console.log('Running scheduled analytics...');
        try {
            const db = admin.firestore();
            const usersSnapshot = await db.collection('users').get();
            const analyticsData = generateAnalyticsData(usersSnapshot);
            const analyticsRef = db.collection('analytics').doc();
            await analyticsRef.set({
                ...analyticsData,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log('Analytics saved:', analyticsRef.id);
            return { success: true, documentId: analyticsRef.id };
        } catch (error) {
            console.error('Error in scheduled analytics:', error);
            throw error;
        }
    });

function generateAnalyticsData(usersSnapshot: admin.firestore.QuerySnapshot) {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const seenPairs = new Set<string>();
    let totalCrushesSent = 0;
    let activeUsersCount = 0;
    const totalUsers = usersSnapshot.size;

    usersSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const userName = data.name || data.email || '(Unnamed User)';

        const userCrushes: string[] = data.crushes || [];
        totalCrushesSent += userCrushes.length;

        if (data.lastLogin) {
            let lastLoginDate: Date;
            if (data.lastLogin.toDate) {
                lastLoginDate = data.lastLogin.toDate();
            } else if (data.lastLogin.seconds) {
                lastLoginDate = new Date(data.lastLogin.seconds * 1000);
            } else {
                lastLoginDate = new Date(data.lastLogin);
            }
            if (lastLoginDate > twentyFourHoursAgo) activeUsersCount++;
        }

        const matches: any[] = data.matches || [];
        matches.forEach((match: any) => {
            const matchName = match.name || match;
            const pair = [userName, matchName].sort().join(' - ');
            seenPairs.add(pair);
        });
    });

    const totalMatches = seenPairs.size;
    const matchedPairs = Array.from(seenPairs).sort();
    const avgCrushes = totalUsers > 0 ? totalCrushesSent / totalUsers : 0;
    const activeUsersLast24h = totalUsers > 0
        ? Number((activeUsersCount / totalUsers * 100).toFixed(2))
        : 0;

    return {
        totalUsers,
        totalMatches,
        matchedPairs,
        totalCrushes: totalCrushesSent,
        avgCrushes: Number(avgCrushes.toFixed(2)),
        activeUsersLast24h
    };
}

export const runAnalyticsNow = functions.https.onRequest(async (req, res) => {
    try {
        const db = admin.firestore();
        const usersSnapshot = await db.collection('users').get();
        const analyticsData = generateAnalyticsData(usersSnapshot);
        const analyticsRef = db.collection('analytics').doc();
        await analyticsRef.set({
            ...analyticsData,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            manual: true
        });
        res.json({ success: true, documentId: analyticsRef.id, data: analyticsData });
    } catch (error) {
        console.error('Error running manual analytics:', error);
        res.status(500).json({ error: 'Failed to generate analytics' });
    }
});
