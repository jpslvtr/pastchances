const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'stanford-lastchances',
});

const db = admin.firestore();

async function getTopCrushCounts() {
    try {
        const snapshot = await db.collection('users').get();
        const crushCounts = [];

        snapshot.forEach(doc => {
            const userData = doc.data();
            const userName = userData.verifiedName || userData.displayName || userData.email || '(Unnamed User)';
            const crushCount = userData.crushCount || 0;

            crushCounts.push({
                name: userName,
                crushCount: crushCount
            });
        });

        // Sort by crush count in descending order (highest first)
        crushCounts.sort((a, b) => b.crushCount - a.crushCount);

        // Get top 20
        const top20 = crushCounts.slice(0, 20);

        console.log(`Top 20 People with Most Crushes (out of ${crushCounts.length} total users):`);
        console.log('='.repeat(60));

        top20.forEach((person, index) => {
            const rank = index + 1;
            const crushText = person.crushCount === 1 ? 'crush' : 'crushes';
            console.log(`${rank.toString().padStart(2)}. ${person.name} - ${person.crushCount} ${crushText}`);
        });

        // Show some stats
        const totalCrushes = crushCounts.reduce((sum, person) => sum + person.crushCount, 0);
        const avgCrushes = totalCrushes / crushCounts.length;
        const peopleWithCrushes = crushCounts.filter(person => person.crushCount > 0).length;

        console.log('\n' + '='.repeat(60));
        console.log(`Stats:`);
        console.log(`- Total people being crushed on: ${peopleWithCrushes}`);
        console.log(`- Total crushes across all users: ${totalCrushes}`);
        console.log(`- Average crushes per person: ${avgCrushes.toFixed(2)}`);

        if (top20.length > 0) {
            console.log(`- Highest crush count: ${top20[0].crushCount}`);
            console.log(`- Top 5 crush counts: ${top20.slice(0, 5).map(p => p.crushCount).join(', ')}`);
        }

    } catch (error) {
        console.error('Error getting crush counts:', error);
    }
}

getTopCrushCounts();