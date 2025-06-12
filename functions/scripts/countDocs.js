const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'stanford-lastchances', // explicitly set this
});

const db = admin.firestore();

async function countDocuments(collectionName) {
    const snapshot = await db.collection(collectionName).get();
    console.log(`Total documents in "${collectionName}":`, snapshot.size);
}

async function main() {
    await countDocuments('users');
    await countDocuments('takenNames');
}

main().catch(console.error);
