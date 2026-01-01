import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { UserData } from './types';
import { getUserIdentityName } from './utils';
import { processUpdatedCrushes, fixAllCrushCounts, processIncrementalUpdate } from './matchingEngine';

export { scheduledAnalytics, runAnalyticsNow } from './scheduledAnalytics';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// Enhanced function to find matches and update crush counts
export const findMatches = functions.firestore
    .document('users/{userId}')
    .onUpdate(async (change, context) => {
        const userId = context.params.userId;
        const beforeData = change.before.data() as UserData;
        const afterData = change.after.data() as UserData;

        // Check if crushes were updated OR if name was updated
        const beforeCrushes = beforeData?.crushes || [];
        const afterCrushes = afterData?.crushes || [];
        const beforeName = getUserIdentityName(beforeData as any);
        const afterName = getUserIdentityName(afterData as any);

        // Normalize arrays for comparison
        const normalizedBefore = beforeCrushes.map(crush => crush.trim().toLowerCase()).sort();
        const normalizedAfter = afterCrushes.map(crush => crush.trim().toLowerCase()).sort();

        const crushesChanged = JSON.stringify(normalizedBefore) !== JSON.stringify(normalizedAfter);
        const nameChanged = beforeName !== afterName;

        console.log(`Checking update for user ${userId} (${afterName})`);
        console.log(`Crushes changed: ${crushesChanged}, Name changed: ${nameChanged}`);

        // Process if crushes changed OR if name changed
        if (crushesChanged || nameChanged) {
            console.log(`✅ Processing update for user ${userId} (${afterName})`);

            // Validate that locked crushes are still present (only for crush changes)
            if (crushesChanged) {
                const lockedCrushes = beforeData?.lockedCrushes || [];
                const missingLockedCrushes = lockedCrushes.filter(locked => !afterCrushes.includes(locked));

                if (missingLockedCrushes.length > 0) {
                    console.log(`❌ User ${userId} tried to remove locked crushes: ${missingLockedCrushes.join(', ')}`);
                    // Restore the locked crushes
                    const restoredCrushes = [...new Set([...afterCrushes, ...lockedCrushes])];

                    const userRef = db.collection('users').doc(userId);
                    await userRef.update({
                        crushes: restoredCrushes,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    console.log(`✅ Restored locked crushes for user ${userId}`);
                    return null;
                }
            }

            // Use incremental update for crush changes, full recalc for name changes
            if (crushesChanged && !nameChanged) {
                const userClass = afterData.userClass || 'gsb';
                await processIncrementalUpdate(userId, beforeCrushes, afterCrushes, afterName, userClass);
            } else {
                // Name changed - need full recalculation since it affects how others match
                await processUpdatedCrushes();
            }
        } else {
            console.log(`❌ No relevant changes detected for user ${userId} (${afterName}), skipping`);
        }

        return null;
    });

// Manual function to trigger complete recalculation
export const recalculateAllMatches = functions.https.onRequest(async (req, res) => {
    try {
        await processUpdatedCrushes();
        res.json({
            success: true,
            message: 'Successfully recalculated all matches and crush counts with enhanced name matching'
        });
    } catch (error) {
        console.error('Error in recalculateAllMatches:', error);
        res.status(500).json({ error: 'Failed to recalculate matches and crush counts' });
    }
});

// Manual function to fix crush count discrepancies
export const fixCrushCountDiscrepancies = functions.https.onRequest(async (req, res) => {
    try {
        console.log('🔧 Starting manual fix of crush count discrepancies...');
        await fixAllCrushCounts();
        res.json({
            success: true,
            message: 'Successfully fixed all crush count discrepancies'
        });
    } catch (error) {
        console.error('❌ Error fixing crush count discrepancies:', error);
        res.status(500).json({ error: 'Failed to fix crush count discrepancies' });
    }
});

// One-time function to add timestamps to existing matches that don't have them
export const addTimestampsToMatches = functions.https.onRequest(async (req, res) => {
    try {
        console.log('🔄 Adding timestamps to existing matches...');

        // Use current timestamp for all existing matches
        const currentTimestamp = admin.firestore.Timestamp.now();

        let updatedUsers = 0;
        let totalMatchesUpdated = 0;

        await db.runTransaction(async (transaction) => {
            // Get all users
            const usersSnapshot = await transaction.get(db.collection('users'));

            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                const matches = userData.matches || [];

                if (matches.length > 0) {
                    // Check if any matches are missing timestamps
                    let needsUpdate = false;
                    const updatedMatches = matches.map((match: any) => {
                        if (!match.matchedAt) {
                            needsUpdate = true;
                            totalMatchesUpdated++;
                            return {
                                ...match,
                                matchedAt: currentTimestamp
                            };
                        }
                        return match;
                    });

                    if (needsUpdate) {
                        const userRef = db.collection('users').doc(doc.id);
                        transaction.update(userRef, {
                            matches: updatedMatches,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                        updatedUsers++;

                        console.log(`✅ Updated ${updatedMatches.filter((m: any) => m.matchedAt === currentTimestamp).length} matches for user: ${userData.name || userData.email}`);
                    }
                }
            });

            console.log(`\n🎉 Migration completed!`);
            console.log(`📊 Updated ${updatedUsers} users`);
            console.log(`💕 Added timestamps to ${totalMatchesUpdated} existing matches`);
        });

        res.json({
            success: true,
            message: `Successfully added timestamps to ${totalMatchesUpdated} existing matches across ${updatedUsers} users`
        });
    } catch (error) {
        console.error('❌ Error adding timestamps to matches:', error);
        res.status(500).json({ error: 'Failed to add timestamps to existing matches' });
    }
});