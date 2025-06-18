import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load service account key - corrected path
const serviceAccount = JSON.parse(
    readFileSync(join(__dirname, '../../functions/src/serviceAccountKey.json'), 'utf8')
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
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

        const top20 = crushCounts.slice(0, 300);

        console.log(`Top People with Most Crushes (out of ${crushCounts.length} total users):`);
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

    } catch (error) {
        console.error('Error getting crush counts:', error);
    }
}

getTopCrushCounts();