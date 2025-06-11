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

            const userCrushes = afterData.crushes || [];
            const userVerifiedName = afterData.verifiedName;

            if (!userVerifiedName || userCrushes.length === 0) {
                console.log(`User ${userId} has no verified name or crushes`);
                return;
            }

            // Find potential matches
            const matches: MatchInfo[] = [];

            // Query all other submitted users
            const allUsersSnapshot = await db.collection('users')
                .where('submitted', '==', true)
                .get();

            for (const userDoc of allUsersSnapshot.docs) {
                const otherUserId = userDoc.id;
                const otherUserData = userDoc.data() as UserData;

                // Skip self
                if (otherUserId === userId) continue;

                const otherUserCrushes = otherUserData.crushes || [];
                const otherUserVerifiedName = otherUserData.verifiedName;
                const otherUserEmail = otherUserData.email;

                // Check if there's a mutual match:
                // 1. Current user has other user's verified name in their crushes
                // 2. Other user has current user's verified name in their crushes
                if (userCrushes.includes(otherUserVerifiedName) &&
                    otherUserCrushes.includes(userVerifiedName)) {
                    matches.push({
                        name: otherUserVerifiedName,
                        email: otherUserEmail
                    });
                    console.log(`Match found: ${userVerifiedName} <-> ${otherUserVerifiedName}`);

                    // Also update the other user's matches if they don't already have this match
                    const otherUserMatches = otherUserData.matches || [];
                    const hasExistingMatch = otherUserMatches.some(match => match.name === userVerifiedName);

                    if (!hasExistingMatch) {
                        const updatedOtherMatches = [...otherUserMatches, {
                            name: userVerifiedName,
                            email: afterData.email
                        }];

                        await db.collection('users').doc(otherUserId).update({
                            matches: updatedOtherMatches,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                        console.log(`Updated ${otherUserId} with match to ${userVerifiedName}`);
                    }
                }
            }

            // Update current user's matches
            if (matches.length > 0) {
                await db.collection('users').doc(userId).update({
                    matches: matches,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`Updated ${userId} with ${matches.length} matches`);
            } else {
                // Ensure matches field exists even if empty
                await db.collection('users').doc(userId).update({
                    matches: [],
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`Updated ${userId} with 0 matches`);
            }
        }
    });

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

        let totalMatches = 0;

        for (const user of users) {
            const userCrushes = user.crushes || [];
            const userVerifiedName = user.verifiedName;
            const matches: MatchInfo[] = [];

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
                    matches.push({
                        name: otherUserVerifiedName,
                        email: otherUserEmail
                    });
                }
            }

            // Update user's matches
            await db.collection('users').doc(user.id).update({
                matches: matches,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            totalMatches += matches.length;
        }

        res.json({
            success: true,
            message: `Processed ${users.length} users, found ${totalMatches} total matches`
        });
    } catch (error) {
        console.error('Error in checkAllMatches:', error);
        res.status(500).json({ error: 'Failed to check matches' });
    }
});