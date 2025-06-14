import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const scheduledAnalytics = functions.pubsub
    .schedule('every 6 hours')
    // .schedule('every 1 minutes')
    .timeZone('America/Los_Angeles')
    .onRun(async (context) => {
        console.log('🔍 Running scheduled analytics...');

        try {
            const db = admin.firestore();

            // Get all data
            const usersSnapshot = await db.collection('users').get();
            const takenNamesSnapshot = await db.collection('takenNames').get();

            // Generate analytics data
            const analyticsData = await generateAnalyticsData(usersSnapshot, takenNamesSnapshot);

            // Store in analytics collection
            const analyticsRef = db.collection('analytics').doc();
            await analyticsRef.set({
                ...analyticsData,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                timestamp: new Date().toISOString()
            });

            console.log('✅ Analytics data saved to Firestore');
            return { success: true, documentId: analyticsRef.id };

        } catch (error) {
            console.error('❌ Error in scheduled analytics:', error);
            throw error;
        }
    });

async function generateAnalyticsData(usersSnapshot: any, takenNamesSnapshot: any) {
    // 1. Basic stats
    const totalUsers = usersSnapshot.size;
    const totalTakenNames = takenNamesSnapshot.size;

    // 2. Process users data
    const allUsers: any[] = [];
    const seenPairs = new Set<string>();

    usersSnapshot.forEach((doc: any) => {
        const userData = doc.data();
        const userName = userData.verifiedName || userData.displayName || userData.email || '(Unnamed User)';

        const userInfo = {
            name: userName,
            crushCount: userData.crushCount || 0,
            matches: userData.matches || [],
            crushes: userData.crushes || []
        };

        allUsers.push(userInfo);

        // Count unique matches
        const matches = userData.matches || [];
        if (Array.isArray(matches) && matches.length > 0) {
            matches.forEach((match: any) => {
                const matchName = match.name || match;
                const pair = [userName, matchName].sort().join(' - ');
                seenPairs.add(pair);
            });
        }
    });

    // 3. Calculate statistics
    const totalMatches = seenPairs.size;
    const matchedPairs = Array.from(seenPairs).sort();

    const totalCrushes = allUsers.reduce((sum, user) => sum + user.crushCount, 0);
    const peopleWithCrushes = allUsers.filter(user => user.crushCount > 0).length;
    const avgCrushes = totalUsers > 0 ? totalCrushes / totalUsers : 0;

    // 4. User activity stats
    const usersWithCrushes = allUsers.filter(user => user.crushes.length > 0).length;
    const usersWithMatches = allUsers.filter(user => user.matches.length > 0).length;

    return {
        // Basic stats
        totalUsers,
        totalTakenNames,

        // Match stats
        totalMatches,
        matchedPairs,

        // Crush stats
        totalCrushes,
        peopleWithCrushes,
        avgCrushes: Number(avgCrushes.toFixed(2)),

        // User activity
        usersWithCrushes,
        usersWithMatches,

        // Activity rates
        participationRate: Number((usersWithCrushes / totalUsers * 100).toFixed(2))
    };
}

// Manual trigger function for testing
export const runAnalyticsNow = functions.https.onRequest(async (req, res) => {
    try {
        const db = admin.firestore();

        const usersSnapshot = await db.collection('users').get();
        const takenNamesSnapshot = await db.collection('takenNames').get();

        const analyticsData = await generateAnalyticsData(usersSnapshot, takenNamesSnapshot);

        const analyticsRef = db.collection('analytics').doc();
        await analyticsRef.set({
            ...analyticsData,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            timestamp: new Date().toISOString(),
            manual: true
        });

        res.json({
            success: true,
            documentId: analyticsRef.id,
            data: analyticsData
        });
    } catch (error) {
        console.error('Error running manual analytics:', error);
        res.status(500).json({ error: 'Failed to generate analytics' });
    }
});