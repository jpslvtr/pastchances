import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccount = JSON.parse(
    readFileSync(join(__dirname, '../../functions/src/serviceAccountKey.json'), 'utf8')
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'stanford-lastchances',
});

const db = admin.firestore();

async function breakdownByClass() {
    try {
        const usersSnapshot = await db.collection('users').get();

        let gsbCount = 0;
        let undergradCount = 0;
        let unknownCount = 0;

        usersSnapshot.forEach(doc => {
            const data = doc.data();
            const userClass = data.userClass || 'unknown';

            if (userClass === 'gsb') gsbCount++;
            else if (userClass === 'undergrad') undergradCount++;
            else unknownCount++;
        });

        console.log('Breakdown by class:');
        console.log(`GSB: ${gsbCount}`);
        console.log(`Undergrad: ${undergradCount}`);
        console.log(`Unknown/No class: ${unknownCount}`);
        console.log(`Total: ${usersSnapshot.size}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

breakdownByClass();