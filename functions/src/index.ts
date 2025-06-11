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
            // Find all users who have submitted
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
            let newMatches: MatchInfo[] = [...currentUserMatches];

            // Track all users that need updates
            const userUpdates = new Map<string, MatchInfo[]>();

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
                const currentUserLikesOther = userCrushes.includes(otherUserVerifiedName);
                const otherUserLikesCurrent = otherUserCrushes.includes(userVerifiedName);

                if (currentUserLikesOther && otherUserLikesCurrent) {
                    // Check if current user already has this match
                    const currentUserHasMatch = newMatches.some(
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
                        userUpdates.set(otherUserId, updatedOtherUserMatches);
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
            for (const [otherUserId, matches] of userUpdates.entries()) {
                const otherUserRef = db.collection('users').doc(otherUserId);
                transaction.update(otherUserRef, {
                    matches: matches,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            console.log(`Updated ${userId} with ${newMatches.length} total matches`);
            console.log(`Updated ${userUpdates.size} other users with new matches`);
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
        const allMatches = new Map<string, MatchInfo[]>();

        // Initialize all users with empty matches
        for (const user of users) {
            allMatches.set(user.id, []);
        }

        // Find all mutual matches
        for (let i = 0; i < users.length; i++) {
            const user1 = users[i];
            const user1Crushes = user1.crushes || [];
            const user1VerifiedName = user1.verifiedName;

            if (!user1VerifiedName || user1Crushes.length === 0) continue;

            for (let j = i + 1; j < users.length; j++) {
                const user2 = users[j];
                const user2Crushes = user2.crushes || [];
                const user2VerifiedName = user2.verifiedName;

                if (!user2VerifiedName || user2Crushes.length === 0) continue;

                // Check if there's a mutual match
                const user1LikesUser2 = user1Crushes.includes(user2VerifiedName);
                const user2LikesUser1 = user2Crushes.includes(user1VerifiedName);

                if (user1LikesUser2 && user2LikesUser1) {
                    // Add match for user1
                    const user1Matches = allMatches.get(user1.id) || [];
                    user1Matches.push({
                        name: user2VerifiedName,
                        email: user2.email
                    });
                    allMatches.set(user1.id, user1Matches);

                    // Add match for user2
                    const user2Matches = allMatches.get(user2.id) || [];
                    user2Matches.push({
                        name: user1VerifiedName,
                        email: user1.email
                    });
                    allMatches.set(user2.id, user2Matches);

                    totalMatchPairs += 1;
                    console.log(`Mutual match: ${user1VerifiedName} <-> ${user2VerifiedName}`);
                }
            }
        }

        // Update all users with their matches in a batch
        const batch = db.batch();
        for (const user of users) {
            const userRef = db.collection('users').doc(user.id);
            batch.update(userRef, {
                matches: allMatches.get(user.id) || [],
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        await batch.commit();

        res.json({
            success: true,
            message: `Processed ${users.length} users, found ${totalMatchPairs} mutual match pairs (${totalMatchPairs * 2} total match connections)`
        });
    } catch (error) {
        console.error('Error in checkAllMatches:', error);
        res.status(500).json({ error: 'Failed to check matches' });
    }
});