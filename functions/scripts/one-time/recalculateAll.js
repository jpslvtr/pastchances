const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'stanford-lastchances',
});

const db = admin.firestore();

async function recalculateAll() {
    try {
        const snapshot = await db.collection('users').get();
        const users = [];

        snapshot.forEach(doc => {
            users.push({
                id: doc.id,
                ...doc.data()
            });
        });

        console.log(`Processing ${users.length} users...`);

        // Calculate crush counts for all users
        const crushCounts = new Map();
        for (const user of users) {
            const userCrushes = user.crushes || [];
            for (const crushName of userCrushes) {
                crushCounts.set(crushName, (crushCounts.get(crushName) || 0) + 1);
            }
        }

        console.log(`Calculated crush counts for ${crushCounts.size} names`);

        // Calculate matches for all users
        const allMatches = new Map();
        let totalMatchPairs = 0;

        for (let i = 0; i < users.length; i++) {
            const user1 = users[i];
            const user1Crushes = user1.crushes || [];
            const user1VerifiedName = user1.verifiedName;

            if (!user1VerifiedName) continue;

            let user1Matches = [];

            for (const crushName of user1Crushes) {
                // Find the user with this verified name
                const user2 = users.find(u => u.verifiedName === crushName);
                if (!user2) continue;

                const user2Crushes = user2.crushes || [];

                // Check if there's a mutual match
                if (user2Crushes.includes(user1VerifiedName)) {
                    user1Matches.push({
                        name: crushName,
                        email: user2.email
                    });

                    // Count this as a match pair only once
                    if (i < users.findIndex(u => u.id === user2.id)) {
                        totalMatchPairs++;
                    }
                }
            }

            allMatches.set(user1.id, user1Matches);
        }

        console.log(`Found ${totalMatchPairs} mutual match pairs`);

        // Update all users with their matches and crush counts in batches
        const batchSize = 500; // Firestore batch limit
        const batches = [];
        let currentBatch = db.batch();
        let operationCount = 0;

        for (const user of users) {
            const userRef = db.collection('users').doc(user.id);
            currentBatch.update(userRef, {
                matches: allMatches.get(user.id) || [],
                crushCount: crushCounts.get(user.verifiedName) || 0,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            operationCount++;

            if (operationCount === batchSize) {
                batches.push(currentBatch);
                currentBatch = db.batch();
                operationCount = 0;
            }
        }

        // Add the last batch if it has operations
        if (operationCount > 0) {
            batches.push(currentBatch);
        }

        // Execute all batches
        console.log(`Executing ${batches.length} batches...`);
        await Promise.all(batches.map(batch => batch.commit()));

        console.log(`Successfully updated all ${users.length} users with matches and crush counts`);
        console.log(`Total mutual match pairs: ${totalMatchPairs}`);

    } catch (error) {
        console.error('Error recalculating all data:', error);
    }
}

recalculateAll();