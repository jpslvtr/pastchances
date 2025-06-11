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
    matches?: string[];
    createdAt: any;
    updatedAt: any;
    lastLogin: any;
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
            const matches: string[] = [];

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

                // Check if there's a mutual match
                if (userCrushes.includes(otherUserVerifiedName) &&
                    otherUserCrushes.includes(userVerifiedName)) {
                    matches.push(otherUserVerifiedName);
                    console.log(`Match found: ${userVerifiedName} <-> ${otherUserVerifiedName}`);
                }
            }

            // Update user's matches
            if (matches.length > 0) {
                await db.collection('users').doc(userId).update({
                    matches: matches,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`Updated ${userId} with ${matches.length} matches`);
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
            const matches: string[] = [];

            if (!userVerifiedName || userCrushes.length === 0) continue;

            // Check against all other users
            for (const otherUser of users) {
                if (otherUser.id === user.id) continue;

                const otherUserCrushes = otherUser.crushes || [];
                const otherUserVerifiedName = otherUser.verifiedName;

                // Check if there's a mutual match
                if (userCrushes.includes(otherUserVerifiedName) &&
                    otherUserCrushes.includes(userVerifiedName)) {
                    matches.push(otherUserVerifiedName);
                }
            }

            // Update user's matches
            if (matches.length > 0) {
                await db.collection('users').doc(user.id).update({
                    matches: matches,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                totalMatches += matches.length;
            }
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