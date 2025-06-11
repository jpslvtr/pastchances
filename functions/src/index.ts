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
    submitted: boolean;
    matches?: MatchInfo[];
    createdAt: any;
    updatedAt: any;
    lastLogin: any;
}

interface MatchInfo {
    name: string;
    email: string;
}

export const findMatches = functions.firestore
    .document('users/{userId}')
    .onUpdate(async (change, context) => {
        const userId = context.params.userId;
        const beforeData = change.before.data() as UserData;
        const afterData = change.after.data() as UserData;

        // Only process if user just submitted (submitted changed from false to true)
        if (!beforeData?.submitted && afterData?.submitted) {
            console.log(`User ${userId} just submitted their list. Checking for matches...`);
            await processNewSubmission(userId, afterData);
        }

        return null;
    });

async function processNewSubmission(userId: string, userData: UserData): Promise<void> {
    const userCrushes = userData.crushes || [];
    const userVerifiedName = userData.verifiedName;

    if (!userVerifiedName || userCrushes.length === 0) {
        console.log(`User ${userId} has no verified name or crushes`);
        return;
    }

    try {
        await db.runTransaction(async (transaction) => {
            // Find all users who have this user in their crushes AND have submitted
            const allUsersSnapshot = await transaction.get(
                db.collection('users').where('submitted', '==', true)
            );

            // Get current user's data to ensure we have the latest version
            const currentUserRef = db.collection('users').doc(userId);
            const currentUserDoc = await transaction.get(currentUserRef);
            const currentUserData = currentUserDoc.data() as UserData;

            if (!currentUserData) {
                console.error(`Could not find user data for ${userId}`);
                return;
            }

            const currentUserMatches = currentUserData.matches || [];
            const newMatches: MatchInfo[] = [...currentUserMatches];

            // Track updates needed for other users
            const userUpdates: { [userId: string]: MatchInfo[] } = {};

            // Check each submitted user for mutual matches
            for (const userDoc of allUsersSnapshot.docs) {
                const otherUserId = userDoc.id;
                const otherUserData = userDoc.data() as UserData;

                // Skip self
                if (otherUserId === userId) continue;

                const otherUserVerifiedName = otherUserData.verifiedName;
                const otherUserEmail = otherUserData.email;
                const otherUserCrushes = otherUserData.crushes || [];
                const otherUserMatches = otherUserData.matches || [];

                // Check for mutual match:
                // 1. Current user has other user's verified name in their crushes
                // 2. Other user has current user's verified name in their crushes
                if (userCrushes.includes(otherUserVerifiedName) &&
                    otherUserCrushes.includes(userVerifiedName)) {

                    // Check if this match already exists for current user
                    const currentUserHasMatch = currentUserMatches.some(
                        match => match.name === otherUserVerifiedName
                    );

                    if (!currentUserHasMatch) {
                        newMatches.push({
                            name: otherUserVerifiedName,
                            email: otherUserEmail
                        });
                        console.log(`New match found: ${userVerifiedName} <-> ${otherUserVerifiedName}`);
                    }

                    // Check if other user already has this match
                    const otherUserHasMatch = otherUserMatches.some(
                        match => match.name === userVerifiedName
                    );

                    if (!otherUserHasMatch) {
                        const updatedOtherUserMatches = [...otherUserMatches, {
                            name: userVerifiedName,
                            email: userData.email
                        }];
                        userUpdates[otherUserId] = updatedOtherUserMatches;
                        console.log(`Will update ${otherUserId} with match to ${userVerifiedName}`);
                    }
                }
            }

            // Update current user's matches
            transaction.update(currentUserRef, {
                matches: newMatches,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Update other users' matches
            for (const [otherUserId, matches] of Object.entries(userUpdates)) {
                const otherUserRef = db.collection('users').doc(otherUserId);
                transaction.update(otherUserRef, {
                    matches: matches,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            console.log(`Updated ${userId} with ${newMatches.length} total matches`);
            console.log(`Updated ${Object.keys(userUpdates).length} other users with new matches`);
        });

    } catch (error) {
        console.error('Error in transaction:', error);
        throw error;
    }
}

// Function to check for matches for all users (can be called manually)
export const checkAllMatches = functions.https.onRequest(async (req, res) => {
    try {
        const allUsersSnapshot = await db.collection('users')
            .where('submitted', '==', true)
            .get();

        const users = allUsersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as UserData)
        }));

        let totalMatchPairs = 0;

        // Use transaction to ensure consistency
        await db.runTransaction(async (transaction) => {
            // Clear all existing matches first
            for (const user of users) {
                const userRef = db.collection('users').doc(user.id);
                transaction.update(userRef, {
                    matches: [],
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            // Find all mutual matches
            const allMatches: { [userId: string]: MatchInfo[] } = {};

            for (const user of users) {
                allMatches[user.id] = [];
                const userCrushes = user.crushes || [];
                const userVerifiedName = user.verifiedName;

                if (!userVerifiedName || userCrushes.length === 0) continue;

                // Check against all other users
                for (const otherUser of users) {
                    if (otherUser.id === user.id) continue;

                    const otherUserCrushes = otherUser.crushes || [];
                    const otherUserVerifiedName = otherUser.verifiedName;
                    const otherUserEmail = otherUser.email;

                    // Check if there's a mutual match
                    if (userCrushes.includes(otherUserVerifiedName) &&
                        otherUserCrushes.includes(userVerifiedName)) {

                        allMatches[user.id].push({
                            name: otherUserVerifiedName,
                            email: otherUserEmail
                        });
                    }
                }
            }

            // Update all users with their matches
            for (const user of users) {
                const userRef = db.collection('users').doc(user.id);
                transaction.update(userRef, {
                    matches: allMatches[user.id],
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                totalMatchPairs += allMatches[user.id].length;
            }
        });

        res.json({
            success: true,
            message: `Processed ${users.length} users, found ${totalMatchPairs} total match connections`
        });
    } catch (error) {
        console.error('Error in checkAllMatches:', error);
        res.status(500).json({ error: 'Failed to check matches' });
    }
});