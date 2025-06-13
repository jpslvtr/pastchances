const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'stanford-lastchances',
});

const db = admin.firestore();

async function cleanupSubmittedStatus() {
    try {
        const snapshot = await db.collection('users').get();
        const batch = db.batch();
        let count = 0;

        snapshot.forEach(doc => {
            const userRef = db.collection('users').doc(doc.id);
            const userData = doc.data();
            const updateData = {
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            // Remove submitted field if it exists
            if (userData.submitted !== undefined) {
                updateData.submitted = admin.firestore.FieldValue.delete();
                console.log(`Removing submitted status from user: ${userData.email}`);
            }

            // Initialize crushCount if it doesn't exist
            if (userData.crushCount === undefined) {
                updateData.crushCount = 0;
                console.log(`Initializing crush count for user: ${userData.email}`);
            }

            batch.update(userRef, updateData);
            count++;
        });

        await batch.commit();
        console.log(`Successfully updated ${count} users - removed submitted status and initialized crush counts`);
    } catch (error) {
        console.error('Error cleaning up submitted status:', error);
    }
}

cleanupSubmittedStatus();