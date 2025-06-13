import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.firestore();

// Define interfaces for type safety
interface UserData {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string;
    verifiedName: string;
    crushes: string[];
    lockedCrushes?: string[]; // New field for locked matches
    matches?: MatchInfo[];
    crushCount?: number;
    createdAt: any;
    updatedAt: any;
    lastLogin: any;
}

interface MatchInfo {
    name: string;
    email: string;
}

// Helper function to normalize names for case-insensitive comparison
function normalizeName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

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
            } catch (error) {
                console.error('Error managing taken names:', error);
            }
        }

        return null;
    });

// Function to find matches and update crush counts whenever crushes are updated
export const findMatches = functions.firestore
    .document('users/{userId}')
    .onUpdate(async (change, context) => {
        const userId = context.params.userId;
        const beforeData = change.before.data() as UserData;
        const afterData = change.after.data() as UserData;

        // Check if crushes were updated
        const beforeCrushes = beforeData?.crushes || [];
        const afterCrushes = afterData?.crushes || [];

        // Normalize arrays for comparison
        const normalizedBefore = beforeCrushes.map(normalizeName).sort();
        const normalizedAfter = afterCrushes.map(normalizeName).sort();

        console.log(`Checking crushes update for user ${userId} (${afterData.verifiedName})`);

        // Only process if crushes actually changed
        if (JSON.stringify(normalizedBefore) !== JSON.stringify(normalizedAfter)) {
            console.log(`✅ Crushes changed for user ${userId} (${afterData.verifiedName}), processing...`);

            // Validate that locked crushes are still present
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
                return null; // Don't process further as we've restored the crushes
            }

            // Add a small delay to prevent race conditions
            await new Promise(resolve => setTimeout(resolve, 1000));

            await processUpdatedCrushes();
        } else {
            console.log(`❌ No crushes change detected for user ${userId} (${afterData.verifiedName}), skipping`);
        }

        return null;
    });

// Consolidated function to recalculate all matches and crush counts
async function processUpdatedCrushes(): Promise<void> {
    console.log('🔄 Starting complete recalculation of all matches and crush counts...');

    try {
        // Use a transaction to ensure consistency
        await db.runTransaction(async (transaction) => {
            // Get all users
            const allUsersSnapshot = await transaction.get(db.collection('users'));

            const allUsers = allUsersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data() as UserData
            }));

            console.log(`📊 Processing ${allUsers.length} users`);

            // Calculate crush counts for all users
            const crushCounts = new Map<string, number>();
            for (const user of allUsers) {
                const userCrushes = user.crushes || [];
                for (const crushName of userCrushes) {
                    // Find the user with this verified name (case-insensitive)
                    const targetUser = allUsers.find(u =>
                        u.verifiedName &&
                        normalizeName(u.verifiedName) === normalizeName(crushName)
                    );

                    if (targetUser) {
                        const actualVerifiedName = targetUser.verifiedName;
                        crushCounts.set(actualVerifiedName, (crushCounts.get(actualVerifiedName) || 0) + 1);
                    }
                }
            }

            console.log('💕 Crush counts calculated:', Object.fromEntries(crushCounts));

            // Calculate matches and locked crushes for all users
            const allMatches = new Map<string, MatchInfo[]>();
            const allLockedCrushes = new Map<string, string[]>();

            for (const user of allUsers) {
                const userMatches: MatchInfo[] = [];
                const userLockedCrushes: string[] = [...(user.lockedCrushes || [])];
                const userCrushes = user.crushes || [];
                const userVerifiedName = user.verifiedName;

                if (!userVerifiedName) {
                    console.log(`⏭️ Skipping user ${user.id} - no verified name`);
                    continue;
                }

                // Find mutual matches for this user
                for (const crushName of userCrushes) {
                    // Find the user with this verified name (case-insensitive)
                    const crushedUser = allUsers.find(u =>
                        u.verifiedName &&
                        normalizeName(u.verifiedName) === normalizeName(crushName)
                    );

                    if (!crushedUser) {
                        continue;
                    }

                    const crushedUserCrushes = crushedUser.crushes || [];

                    // Check if it's a mutual match (case-insensitive)
                    const hasMutualCrush = crushedUserCrushes.some(crush =>
                        normalizeName(crush) === normalizeName(userVerifiedName)
                    );

                    if (hasMutualCrush) {
                        userMatches.push({
                            name: crushedUser.verifiedName,
                            email: crushedUser.email
                        });

                        // Lock this crush - user cannot remove it anymore
                        if (!userLockedCrushes.includes(crushName)) {
                            userLockedCrushes.push(crushName);
                        }
                    }
                }

                allMatches.set(user.id, userMatches);
                allLockedCrushes.set(user.id, userLockedCrushes);
            }

            // Update all users with their matches, crush counts, and locked crushes
            for (const user of allUsers) {
                const userRef = db.collection('users').doc(user.id);
                const updateData = {
                    matches: allMatches.get(user.id) || [],
                    lockedCrushes: allLockedCrushes.get(user.id) || [],
                    crushCount: crushCounts.get(user.verifiedName) || 0,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };

                transaction.update(userRef, updateData);
            }

            console.log(`✅ Updated all ${allUsers.length} users with new matches, locked crushes, and crush counts`);
        });

    } catch (error) {
        console.error('❌ Error in processUpdatedCrushes:', error);
        throw error;
    }
}

// Manual function to trigger complete recalculation
export const recalculateAllMatches = functions.https.onRequest(async (req, res) => {
    try {
        await processUpdatedCrushes();
        res.json({
            success: true,
            message: 'Successfully recalculated all matches and crush counts'
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