const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'stanford-lastchances',
});

const db = admin.firestore();

const targetNames = ["Mira Bodek (Mibo)"];

async function findCrushes() {
    const snapshot = await db.collection('users').get();
    const foundMap = {};

    // Initialize found map
    targetNames.forEach(name => {
        foundMap[name] = false;
    });

    snapshot.forEach(doc => {
        const userName = doc.get('verifiedName') || '(Unnamed User)';
        const crushes = doc.get('crushes') || [];

        crushes.forEach(crush => {
            if (targetNames.includes(crush)) {
                foundMap[crush] = true;
                console.log(`${userName} has a crush on "${crush}"`);
            }
        });
    });

}

findCrushes().catch(console.error);
