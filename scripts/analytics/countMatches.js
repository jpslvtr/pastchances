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

async function countUniqueMatches() {
    const snapshot = await db.collection('users').get();
    const seenPairs = new Set();

    snapshot.forEach(doc => {
        const userName = doc.get('verifiedName') || '(Unnamed User)';
        const matches = doc.get('matches');

        if (Array.isArray(matches) && matches.length > 0) {
            matches.forEach(match => {
                const matchName = match.name;
                const pair = [userName, matchName].sort().join(' - ');
                seenPairs.add(pair);
            });
        }
    });

    console.log(`Total unique matches: ${seenPairs.size}`);
    console.log('Matched pairs:');
    seenPairs.forEach(pair => console.log(`- ${pair}`));
}

countUniqueMatches().catch(console.error);