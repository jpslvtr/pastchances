import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { UserData, UserWithId } from './types';
import { findUserByName, getUserIdentityName } from './utils';
import { processUpdatedCrushes } from './matchingEngine';

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

        // Process if crushes changed OR if name changed (which affects how others' crushes map to this user)
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

            // Add a small delay to prevent race conditions
            await new Promise(resolve => setTimeout(resolve, 1000));

            await processUpdatedCrushes();
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

// Migration function to clean up and standardize the database
export const migrateToSingleNameField = functions.https.onRequest(async (req, res) => {
    try {
        console.log('🔄 Starting migration to single name field...');

        await db.runTransaction(async (transaction) => {
            // Get all users
            const allUsersSnapshot = await transaction.get(db.collection('users'));

            const allUsers: UserWithId[] = allUsersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data() as any
            }));

            console.log(`📊 Processing ${allUsers.length} users for migration`);

            let migratedUsers = 0;
            let errorUsers = 0;

            for (const user of allUsers) {
                const userRef = db.collection('users').doc(user.id);

                try {
                    // Determine the best name to use
                    let finalName = user.name;

                    if (!finalName || finalName.trim() === '') {
                        // Try verifiedName first, then displayName
                        finalName = user.verifiedName || user.displayName || '';
                    }

                    if (!finalName || finalName.trim() === '') {
                        console.log(`⚠️ User ${user.id} (${user.email}) has no name - skipping`);
                        errorUsers++;
                        continue;
                    }

                    // Prepare update data
                    const updateData: any = {
                        name: finalName,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    };

                    // Remove legacy fields if they exist
                    if (user.displayName !== undefined) {
                        updateData.displayName = admin.firestore.FieldValue.delete();
                    }
                    if (user.verifiedName !== undefined) {
                        updateData.verifiedName = admin.firestore.FieldValue.delete();
                    }

                    transaction.update(userRef, updateData);
                    migratedUsers++;

                    console.log(`✅ Migrated user ${user.email}: "${finalName}"`);

                } catch (error) {
                    console.error(`❌ Error migrating user ${user.id}:`, error);
                    errorUsers++;
                }
            }

            console.log(`🎉 Migration completed! Migrated: ${migratedUsers}, Errors: ${errorUsers}`);

            // Now trigger a recalculation to fix any crush references
            setTimeout(async () => {
                await processUpdatedCrushes();
            }, 2000);
        });

        res.json({
            success: true,
            message: 'Successfully migrated users to single name field'
        });
    } catch (error) {
        console.error('❌ Error in migration:', error);
        res.status(500).json({ error: 'Failed to migrate users' });
    }
});

// Remove the manageTakenNames function since we're no longer using takenNames collection

// Clean up orphaned crushes function
export const cleanupOrphanedCrushes = functions.https.onRequest(async (req, res) => {
    try {
        console.log('🔧 Starting cleanup of orphaned crushes...');

        await db.runTransaction(async (transaction) => {
            // Get all users
            const allUsersSnapshot = await transaction.get(db.collection('users'));

            const allUsers: UserWithId[] = allUsersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data() as any
            }));

            console.log(`📊 Processing ${allUsers.length} users for cleanup`);

            // Find all unique crush names and map them to actual users
            const allCrushNames = new Set<string>();
            const crushToUserMap = new Map<string, UserWithId>();

            allUsers.forEach(user => {
                const userCrushes = user.crushes || [];
                userCrushes.forEach(crushName => {
                    allCrushNames.add(crushName);
                });

                // Map user's identity name to the user
                const identityName = getUserIdentityName(user);
                if (identityName) {
                    crushToUserMap.set(identityName, user);
                }
            });

            console.log(`🔍 Found ${allCrushNames.size} unique crush names`);

            // Update crushes to use consistent names
            let updatedUsers = 0;

            for (const user of allUsers) {
                const userCrushes = user.crushes || [];
                let needsUpdate = false;
                const updatedCrushes: string[] = [];

                for (const crushName of userCrushes) {
                    const targetUser = findUserByName(crushName, allUsers);

                    if (targetUser) {
                        const correctName = getUserIdentityName(targetUser);
                        if (correctName && correctName !== crushName) {
                            console.log(`🔧 Updating crush "${crushName}" -> "${correctName}" for user ${user.email}`);
                            needsUpdate = true;
                        }
                        updatedCrushes.push(correctName || crushName);
                    } else {
                        // Keep orphaned crushes as-is (they might sign up later)
                        updatedCrushes.push(crushName);
                    }
                }

                if (needsUpdate) {
                    const userRef = db.collection('users').doc(user.id);
                    transaction.update(userRef, {
                        crushes: updatedCrushes,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    updatedUsers++;
                }
            }

            console.log(`✅ Updated ${updatedUsers} users with cleaned crush references`);

            // Trigger recalculation
            setTimeout(async () => {
                await processUpdatedCrushes();
            }, 2000);
        });

        res.json({
            success: true,
            message: 'Successfully cleaned up orphaned crushes'
        });
    } catch (error) {
        console.error('❌ Error in cleanup:', error);
        res.status(500).json({ error: 'Failed to cleanup orphaned crushes' });
    }
});

// Clean up takenNames collection since we're not using it anymore
export const removeTakenNamesCollection = functions.https.onRequest(async (req, res) => {
    try {
        console.log('🗑️ Removing takenNames collection...');

        const takenNamesSnapshot = await db.collection('takenNames').get();

        if (takenNamesSnapshot.empty) {
            res.json({
                success: true,
                message: 'takenNames collection is already empty'
            });
            return;
        }

        const batch = db.batch();
        takenNamesSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        res.json({
            success: true,
            message: `Deleted ${takenNamesSnapshot.size} documents from takenNames collection`
        });
    } catch (error) {
        console.error('❌ Error removing takenNames collection:', error);
        res.status(500).json({ error: 'Failed to remove takenNames collection' });
    }
});