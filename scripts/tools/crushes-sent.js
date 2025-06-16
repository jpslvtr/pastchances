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

async function getTopCrushesSent() {
    try {
        const snapshot = await db.collection('users').get();
        const crushesSent = [];

        snapshot.forEach(doc => {
            const userData = doc.data();
            const userName = userData.verifiedName || userData.displayName || userData.email || '(Unnamed User)';
            const crushes = userData.crushes || [];
            const crushesSentCount = crushes.length;

            crushesSent.push({
                name: userName,
                crushesSent: crushesSentCount,
                crushNames: crushes // Include the actual names for reference
            });
        });

        // Sort by crushes sent in descending order (highest first)
        crushesSent.sort((a, b) => b.crushesSent - a.crushesSent);

        console.log(`People Who Have Sent Crushes (out of ${crushesSent.length} total users):`);
        console.log('='.repeat(80));

        crushesSent.forEach((person, index) => {
            const rank = index + 1;
            const crushText = person.crushesSent === 1 ? 'crush' : 'crushes';
            console.log(`${rank.toString().padStart(2)}. ${person.name} - ${person.crushesSent} ${crushText} sent`);

            // Optionally show who they crushed on (uncomment if you want to see details)
            // if (person.crushNames.length > 0) {
            //     console.log(`    Crushes: ${person.crushNames.join(', ')}`);
            // }
        });

        // Show some summary stats
        const totalCrushesSent = crushesSent.reduce((sum, person) => sum + person.crushesSent, 0);
        const avgCrushesSent = totalCrushesSent / crushesSent.length;
        const peopleWhoSentCrushes = crushesSent.filter(person => person.crushesSent > 0).length;
        const maxCrushesSent = crushesSent.length > 0 ? crushesSent[0].crushesSent : 0;

        console.log('\n' + '='.repeat(80));
        console.log('SUMMARY STATISTICS:');
        console.log(`Total crushes sent across all users: ${totalCrushesSent}`);
        console.log(`Average crushes sent per user: ${avgCrushesSent.toFixed(2)}`);
        console.log(`People who have sent crushes: ${peopleWhoSentCrushes}/${crushesSent.length}`);
        console.log(`Highest number of crushes sent by one person: ${maxCrushesSent}`);
        console.log('='.repeat(80));

    } catch (error) {
        console.error('Error getting crushes sent:', error);
    } finally {
        process.exit(0);
    }
}

getTopCrushesSent();