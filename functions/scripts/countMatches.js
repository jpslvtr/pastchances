const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'stanford-lastchances', // make sure this matches your project
});

const db = admin.firestore();

async function countUsersWithMatches() {
    const snapshot = await db.collection('users').get();

    let totalUsers = 0;
    let usersWithMatches = 0;

    snapshot.forEach(doc => {
        totalUsers++;
        const matches = doc.get('matches');
        if (Array.isArray(matches) && matches.length > 0) {
            usersWithMatches++;
        }
    });

    console.log(`Total users: ${totalUsers}`);
    console.log(`Users with populated matches: ${usersWithMatches}`);
}

countUsersWithMatches().catch(console.error);
