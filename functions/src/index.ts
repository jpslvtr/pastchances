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
    lockedCrushes?: string[];
    matches?: MatchInfo[];
    crushCount?: number;
    createdAt: any;
    updatedAt: any;
    lastLogin: any;
}

interface UserWithId extends UserData {
    id: string;
}

interface MatchInfo {
    name: string;
    email: string;
}

// Enhanced helper function to normalize names for case-insensitive comparison
function normalizeName(name: string): string {
    if (!name || typeof name !== 'string') return '';
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Function to find the best matching user for a crush name
function findUserByName(crushName: string, allUsers: UserWithId[]): UserWithId | null {
    if (!crushName || !crushName.trim()) return null;

    const normalizedCrush = normalizeName(crushName);

    // First try exact match on verifiedName
    let match = allUsers.find(user =>
        user.verifiedName &&
        normalizeName(user.verifiedName) === normalizedCrush
    );

    if (match) return match;

    // Try exact match on displayName as fallback
    match = allUsers.find(user =>
        user.displayName &&
        normalizeName(user.displayName) === normalizedCrush
    );

    if (match) return match;

    // Try partial match (first and last name only) for cases with middle names
    const crushParts = normalizedCrush.split(' ');
    if (crushParts.length >= 2) {
        const crushFirstLast = `${crushParts[0]} ${crushParts[crushParts.length - 1]}`;

        match = allUsers.find(user => {
            if (user.verifiedName) {
                const nameParts = normalizeName(user.verifiedName).split(' ');
                if (nameParts.length >= 2) {
                    const nameFirstLast = `${nameParts[0]} ${nameParts[nameParts.length - 1]}`;
                    return nameFirstLast === crushFirstLast;
                }
            }
            return false;
        });

        if (match) return match;

        // Try same with displayName
        match = allUsers.find(user => {
            if (user.displayName) {
                const nameParts = normalizeName(user.displayName).split(' ');
                if (nameParts.length >= 2) {
                    const nameFirstLast = `${nameParts[0]} ${nameParts[nameParts.length - 1]}`;
                    return nameFirstLast === crushFirstLast;
                }
            }
            return false;
        });
    }

    return match || null;
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
                return null;
            }

            // Add a small delay to prevent race conditions
            await new Promise(resolve => setTimeout(resolve, 1000));

            await processUpdatedCrushes();
        } else {
            console.log(`❌ No crushes change detected for user ${userId} (${afterData.verifiedName}), skipping`);
        }

        return null;
    });

// Enhanced function to recalculate all matches and crush counts with better name matching
async function processUpdatedCrushes(): Promise<void> {
    console.log('🔄 Starting enhanced recalculation of all matches and crush counts...');

    try {
        await db.runTransaction(async (transaction) => {
            // Get all users
            const allUsersSnapshot = await transaction.get(db.collection('users'));

            const allUsers: UserWithId[] = allUsersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data() as UserData
            }));

            console.log(`📊 Processing ${allUsers.length} users`);

            // Enhanced crush count calculation with better name matching
            const crushCounts = new Map<string, number>();

            for (const user of allUsers) {
                const userCrushes = user.crushes || [];
                for (const crushName of userCrushes) {
                    // Find the actual user that matches this crush name
                    const targetUser = findUserByName(crushName, allUsers);

                    if (targetUser) {
                        // Use verifiedName if available, otherwise displayName
                        const actualName = targetUser.verifiedName || targetUser.displayName;
                        if (actualName) {
                            crushCounts.set(actualName, (crushCounts.get(actualName) || 0) + 1);
                        }
                    }
                }
            }

            console.log('💕 Enhanced crush counts calculated:', Object.fromEntries(crushCounts));

            // Calculate matches and locked crushes with enhanced matching
            const allMatches = new Map<string, MatchInfo[]>();
            const allLockedCrushes = new Map<string, string[]>();

            for (const user of allUsers) {
                const userMatches: MatchInfo[] = [];
                const userLockedCrushes: string[] = [...(user.lockedCrushes || [])];
                const userCrushes = user.crushes || [];
                const userIdentityName = user.verifiedName || user.displayName;

                if (!userIdentityName || !userIdentityName.trim()) {
                    console.log(`⏭️ Skipping user ${user.id} - no identity name`);
                    allMatches.set(user.id, userMatches);
                    allLockedCrushes.set(user.id, userLockedCrushes);
                    continue;
                }

                // Find mutual matches with enhanced name matching
                for (const crushName of userCrushes) {
                    const crushedUser = findUserByName(crushName, allUsers);

                    if (!crushedUser) {
                        console.log(`⚠️ No user found for crush name: "${crushName}"`);
                        continue;
                    }

                    const crushedUserCrushes = crushedUser.crushes || [];

                    // Check if it's a mutual match using enhanced matching
                    const hasMutualCrush = crushedUserCrushes.some(crush => {
                        const matchedUser = findUserByName(crush, allUsers);
                        return matchedUser && matchedUser.id === user.id;
                    });

                    if (hasMutualCrush) {
                        const crushedUserIdentityName = crushedUser.verifiedName || crushedUser.displayName;
                        userMatches.push({
                            name: crushedUserIdentityName,
                            email: crushedUser.email
                        });

                        // Lock this crush
                        if (!userLockedCrushes.includes(crushName)) {
                            userLockedCrushes.push(crushName);
                        }

                        console.log(`💕 Match found: ${userIdentityName} ↔ ${crushedUserIdentityName}`);
                    }
                }

                allMatches.set(user.id, userMatches);
                allLockedCrushes.set(user.id, userLockedCrushes);
            }

            // Update all users with their matches, crush counts, and locked crushes
            for (const user of allUsers) {
                const userRef = db.collection('users').doc(user.id);
                const userIdentityName = user.verifiedName || user.displayName;
                const updateData = {
                    matches: allMatches.get(user.id) || [],
                    lockedCrushes: allLockedCrushes.get(user.id) || [],
                    crushCount: crushCounts.get(userIdentityName) || 0,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };

                transaction.update(userRef, updateData);
            }

            console.log(`✅ Updated all ${allUsers.length} users with enhanced matches and crush counts`);
        });

    } catch (error) {
        console.error('❌ Error in enhanced processUpdatedCrushes:', error);
        throw error;
    }
}

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

