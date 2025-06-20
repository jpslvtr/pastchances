import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { UserData, UserWithId } from './types';
import { findUserByName } from './utils';
import { processUpdatedCrushes } from './matchingEngine';

export { scheduledAnalytics, runAnalyticsNow } from './scheduledAnalytics';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// Function to manage taken names when a user updates their verifiedName
export const manageTakenNames = functions.firestore
    .document('users/{userId}')
    .onUpdate(async (change, context) => {
        const beforeData = change.before.data() as UserData;
        const afterData = change.after.data() as UserData;

        // Check if verifiedName was added or changed
        const oldVerifiedName = beforeData?.verifiedName;
        const newVerifiedName = afterData?.verifiedName;

        if (oldVerifiedName !== newVerifiedName) {
            try {
                // If there was an old verified name, remove it from taken names
                if (oldVerifiedName && oldVerifiedName.trim() !== '') {
                    const oldNameDoc = db.collection('takenNames').doc(oldVerifiedName);
                    await oldNameDoc.delete();
                    console.log(`Removed ${oldVerifiedName} from taken names`);
                }

                // If there's a new verified name, add it to taken names
                if (newVerifiedName && newVerifiedName.trim() !== '') {
                    const newNameDoc = db.collection('takenNames').doc(newVerifiedName);
                    await newNameDoc.set({
                        takenBy: afterData.uid,
                        takenAt: admin.firestore.FieldValue.serverTimestamp(),
                        email: afterData.email
                    });
                    console.log(`Added ${newVerifiedName} to taken names`);
                }

                // IMPORTANT: Trigger recalculation when verifiedName changes
                // This ensures crush counts get updated when someone's identity changes
                if (newVerifiedName && newVerifiedName.trim() !== '') {
                    console.log(`🔄 VerifiedName changed for user ${afterData.uid}, triggering recalculation...`);
                    // Add a small delay to ensure the taken name is updated first
                    setTimeout(async () => {
                        await processUpdatedCrushes();
                    }, 2000);
                }
            } catch (error) {
                console.error('Error managing taken names:', error);
            }
        }

        return null;
    });

// Add this new function after manageTakenNames
export const autoCleanupOrphanedCrushes = functions.firestore
    .document('users/{userId}')
    .onUpdate(async (change, context) => {
        const beforeData = change.before.data() as UserData;
        const afterData = change.after.data() as UserData;

        // Only run if verifiedName changed
        const oldVerifiedName = beforeData?.verifiedName;
        const newVerifiedName = afterData?.verifiedName;

        if (oldVerifiedName !== newVerifiedName && oldVerifiedName && newVerifiedName) {
            console.log(`🔄 User changed name from "${oldVerifiedName}" to "${newVerifiedName}", cleaning up orphaned crushes...`);

            try {
                // Get all users to find who has the old name in their crushes
                const allUsersSnapshot = await db.collection('users').get();
                const usersToUpdate: { id: string; crushes: string[]; lockedCrushes: string[] }[] = [];

                allUsersSnapshot.forEach(doc => {
                    const userData = doc.data() as UserData;
                    const userCrushes = userData.crushes || [];
                    const userLockedCrushes = userData.lockedCrushes || [];

                    // Check if this user has the old name in their crushes
                    if (userCrushes.includes(oldVerifiedName) || userLockedCrushes.includes(oldVerifiedName)) {
                        // Update the crushes to use the new name
                        const updatedCrushes = userCrushes.map(crush =>
                            crush === oldVerifiedName ? newVerifiedName : crush
                        );
                        const updatedLockedCrushes = userLockedCrushes.map(crush =>
                            crush === oldVerifiedName ? newVerifiedName : crush
                        );

                        usersToUpdate.push({
                            id: doc.id,
                            crushes: updatedCrushes,
                            lockedCrushes: updatedLockedCrushes
                        });
                    }
                });

                // Update all affected users
                if (usersToUpdate.length > 0) {
                    const batch = db.batch();

                    usersToUpdate.forEach(({ id, crushes, lockedCrushes }) => {
                        const userRef = db.collection('users').doc(id);
                        batch.update(userRef, {
                            crushes,
                            lockedCrushes,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                    });

                    await batch.commit();
                    console.log(`✅ Updated ${usersToUpdate.length} users who had "${oldVerifiedName}" in their crushes`);

                    // Trigger a recalculation after a short delay
                    setTimeout(async () => {
                        await processUpdatedCrushes();
                    }, 2000);
                }

            } catch (error) {
                console.error('❌ Error in autoCleanupOrphanedCrushes:', error);
            }
        }

        return null;
    });

// Enhanced function to find matches and update crush counts
export const findMatches = functions.firestore
    .document('users/{userId}')
    .onUpdate(async (change, context) => {
        const userId = context.params.userId;
        const beforeData = change.before.data() as UserData;
        const afterData = change.after.data() as UserData;

        // Check if crushes were updated OR if verifiedName was updated
        const beforeCrushes = beforeData?.crushes || [];
        const afterCrushes = afterData?.crushes || [];
        const beforeVerifiedName = beforeData?.verifiedName;
        const afterVerifiedName = afterData?.verifiedName;

        // Normalize arrays for comparison
        const normalizedBefore = beforeCrushes.map(crush => crush.trim().toLowerCase()).sort();
        const normalizedAfter = afterCrushes.map(crush => crush.trim().toLowerCase()).sort();

        const crushesChanged = JSON.stringify(normalizedBefore) !== JSON.stringify(normalizedAfter);
        const verifiedNameChanged = beforeVerifiedName !== afterVerifiedName;

        console.log(`Checking update for user ${userId} (${afterData.verifiedName})`);
        console.log(`Crushes changed: ${crushesChanged}, VerifiedName changed: ${verifiedNameChanged}`);

        // Process if crushes changed OR if verifiedName changed (which affects how others' crushes map to this user)
        if (crushesChanged || verifiedNameChanged) {
            console.log(`✅ Processing update for user ${userId} (${afterData.verifiedName})`);

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

            // Add a small delay to prevent race conditions
            await new Promise(resolve => setTimeout(resolve, 1000));

            await processUpdatedCrushes();
        } else {
            console.log(`❌ No relevant changes detected for user ${userId} (${afterData.verifiedName}), skipping`);
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

// Initialize taken names for existing users (run this once)
export const initializeTakenNames = functions.https.onRequest(async (req, res) => {
    try {
        const allUsersSnapshot = await db.collection('users').get();
        const batch = db.batch();
        let count = 0;

        allUsersSnapshot.forEach((doc) => {
            const userData = doc.data() as UserData;
            if (userData.verifiedName && userData.verifiedName.trim() !== '') {
                const nameDoc = db.collection('takenNames').doc(userData.verifiedName);
                batch.set(nameDoc, {
                    takenBy: userData.uid,
                    takenAt: admin.firestore.FieldValue.serverTimestamp(),
                    email: userData.email
                });
                count++;
            }
        });

        await batch.commit();

        res.json({
            success: true,
            message: `Initialized ${count} taken names`
        });
    } catch (error) {
        console.error('Error initializing taken names:', error);
        res.status(500).json({ error: 'Failed to initialize taken names' });
    }
});

// Reset all users to remove submitted status
export const resetSubmittedStatus = functions.https.onRequest(async (req, res) => {
    try {
        const allUsersSnapshot = await db.collection('users').get();

        // Process in batches to avoid hitting Firestore limits
        const batchSize = 500;
        const batches = [];
        let currentBatch = db.batch();
        let operationCount = 0;

        allUsersSnapshot.forEach((doc) => {
            const userRef = db.collection('users').doc(doc.id);
            const userData = doc.data();
            const updateData: any = {
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            // Remove submitted field if it exists
            if (userData.submitted !== undefined) {
                updateData.submitted = admin.firestore.FieldValue.delete();
            }

            // Initialize crushCount if it doesn't exist
            if (userData.crushCount === undefined) {
                updateData.crushCount = 0;
            }

            // Initialize lockedCrushes if it doesn't exist
            if (userData.lockedCrushes === undefined) {
                updateData.lockedCrushes = [];
            }

            currentBatch.update(userRef, updateData);
            operationCount++;

            if (operationCount === batchSize) {
                batches.push(currentBatch);
                currentBatch = db.batch();
                operationCount = 0;
            }
        });

        // Add the last batch if it has operations
        if (operationCount > 0) {
            batches.push(currentBatch);
        }

        // Execute all batches
        await Promise.all(batches.map(batch => batch.commit()));

        res.json({
            success: true,
            message: `Reset submitted status for ${allUsersSnapshot.size} users and initialized crush counts and locked crushes`
        });
    } catch (error) {
        console.error('Error resetting submitted status:', error);
        res.status(500).json({ error: 'Failed to reset submitted status' });
    }
});

// New function to initialize locked crushes for existing users
export const initializeLockedCrushes = functions.https.onRequest(async (req, res) => {
    try {
        const allUsersSnapshot = await db.collection('users').get();
        const batch = db.batch();
        let count = 0;

        allUsersSnapshot.forEach((doc) => {
            const userData = doc.data() as UserData;
            const userRef = db.collection('users').doc(doc.id);

            // Initialize lockedCrushes if it doesn't exist
            if (userData.lockedCrushes === undefined) {
                batch.update(userRef, {
                    lockedCrushes: [],
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                count++;
            }
        });

        await batch.commit();

        res.json({
            success: true,
            message: `Initialized lockedCrushes for ${count} users`
        });
    } catch (error) {
        console.error('Error initializing locked crushes:', error);
        res.status(500).json({ error: 'Failed to initialize locked crushes' });
    }
});

// One-time cleanup function to fix inconsistent locked crushes
export const cleanupInconsistentLockedCrushes = functions.https.onRequest(async (req, res) => {
    try {
        console.log('🔧 Starting cleanup of inconsistent locked crushes...');

        await db.runTransaction(async (transaction) => {
            // Get all users
            const allUsersSnapshot = await transaction.get(db.collection('users'));

            const allUsers: UserWithId[] = allUsersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data() as UserData
            }));

            console.log(`📊 Processing ${allUsers.length} users for cleanup`);

            let fixedUsers = 0;

            for (const user of allUsers) {
                const userCrushes = user.crushes || [];
                const userLockedCrushes = user.lockedCrushes || [];
                const userIdentityName = user.verifiedName || user.displayName;

                if (!userIdentityName || !userIdentityName.trim()) {
                    continue;
                }

                // Find actual mutual matches
                const validLockedCrushes: string[] = [];

                for (const crushName of userCrushes) {
                    const crushedUser = findUserByName(crushName, allUsers);

                    if (!crushedUser) {
                        continue;
                    }

                    const crushedUserCrushes = crushedUser.crushes || [];

                    // Check if it's a mutual match
                    const hasMutualCrush = crushedUserCrushes.some(crush => {
                        const matchedUser = findUserByName(crush, allUsers);
                        return matchedUser && matchedUser.id === user.id;
                    });

                    // Only lock if there's a mutual match
                    if (hasMutualCrush) {
                        validLockedCrushes.push(crushName);
                    }
                }

                // Check if we need to update this user
                const currentLocked = userLockedCrushes.sort();
                const validLocked = validLockedCrushes.sort();

                if (JSON.stringify(currentLocked) !== JSON.stringify(validLocked)) {
                    console.log(`🔧 Fixing user ${userIdentityName}: ${currentLocked.length} -> ${validLocked.length} locked crushes`);

                    const userRef = db.collection('users').doc(user.id);
                    transaction.update(userRef, {
                        lockedCrushes: validLockedCrushes,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    fixedUsers++;
                }
            }

            console.log(`✅ Fixed ${fixedUsers} users with inconsistent locked crushes`);
        });

        res.json({
            success: true,
            message: 'Successfully cleaned up inconsistent locked crushes'
        });
    } catch (error) {
        console.error('❌ Error in cleanupInconsistentLockedCrushes:', error);
        res.status(500).json({ error: 'Failed to cleanup inconsistent locked crushes' });
    }
});