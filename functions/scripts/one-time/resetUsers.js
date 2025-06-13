const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'stanford-lastchances',
});

const db = admin.firestore();

async function resetUsers() {
    try {
        const snapshot = await db.collection('users').get();
        const batch = db.batch();
        let count = 0;

        snapshot.forEach(doc => {
            const userRef = db.collection('users').doc(doc.id);

            // Remove the submitted field and initialize crushCount if it doesn't exist
            const userData = doc.data();
            const updateData = {
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

            batch.update(userRef, updateData);
            count++;
        });

        await batch.commit();
        console.log(`Reset ${count} users - removed submitted status and initialized crush counts`);
    } catch (error) {
        console.error('Error resetting users:', error);
    }
}

resetUsers();