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
                createdAt: admin.firestore.FieldValue.serverTimestamp()
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
    let totalCrushesSent = 0;
    let activeUsersCount = 0;

    // Calculate 24 hours ago timestamp
    const twentyFourHoursAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));

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

        // Count crushes sent (actual crushes array length, not crushCount which is crushes received)
        const userCrushes = userData.crushes || [];
        totalCrushesSent += userCrushes.length;

        // Check if user was active in last 24 hours
        if (userData.lastLogin) {
            let lastLoginDate;

            // Handle both Firestore Timestamp and regular Date
            if (userData.lastLogin.toDate) {
                lastLoginDate = userData.lastLogin.toDate();
            } else if (userData.lastLogin.seconds) {
                lastLoginDate = new Date(userData.lastLogin.seconds * 1000);
            } else {
                lastLoginDate = new Date(userData.lastLogin);
            }

            if (lastLoginDate > twentyFourHoursAgo) {
                activeUsersCount++;
            }
        }

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

    const peopleWithCrushes = allUsers.filter(user => user.crushCount > 0).length;
    const avgCrushes = totalUsers > 0 ? totalCrushesSent / totalUsers : 0;

    // Calculate active user percentage
    const activeUsersLast24h = totalUsers > 0 ? Number((activeUsersCount / totalUsers * 100).toFixed(2)) : 0;

    return {
        // Basic stats
        totalUsers,
        totalTakenNames,

        // Match stats
        totalMatches,
        matchedPairs,

        // Crush stats
        totalCrushes: totalCrushesSent,
        peopleWithCrushes,
        avgCrushes: Number(avgCrushes.toFixed(2)),

        // Activity stats
        activeUsersLast24h // Now a percentage (0-100)
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