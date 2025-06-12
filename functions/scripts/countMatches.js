const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'stanford-lastchances',
});

const db = admin.firestore();

async function listUserMatches() {
    const snapshot = await db.collection('users').get();

    snapshot.forEach(doc => {
        const userName = doc.get('verifiedName') || '(Unnamed User)';
        const matches = doc.get('matches');

        if (Array.isArray(matches) && matches.length > 0) {
            console.log(`\nUser: ${userName}`);
            matches.forEach((match, index) => {
                console.log(`  Match ${index + 1}: ${match.name}`);
            });
        }
    });
}

listUserMatches().catch(console.error);
