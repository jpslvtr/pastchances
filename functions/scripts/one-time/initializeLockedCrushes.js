const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'stanford-lastchances',
});

const db = admin.firestore();

async function initializeLockedCrushes() {
    try {
        const snapshot = await db.collection('users').get();
        const batch = db.batch();
        let count = 0;

        snapshot.forEach(doc => {
            const userData = doc.data();
            const userRef = db.collection('users').doc(doc.id);

            // Initialize lockedCrushes if it doesn't exist
            if (userData.lockedCrushes === undefined) {
                batch.update(userRef, {
                    lockedCrushes: [],
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                count++;
                console.log(`Initializing lockedCrushes for user: ${userData.email}`);
            }
        });

        await batch.commit();
        console.log(`Successfully initialized lockedCrushes for ${count} users`);
    } catch (error) {
        console.error('Error initializing locked crushes:', error);
    }
}

initializeLockedCrushes();