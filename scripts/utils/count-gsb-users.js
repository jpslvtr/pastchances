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

async function countGSBUsers() {
    const gsbSnapshot = await db.collection('users')
        .where('userClass', '==', 'undergrad')
        .get();

    console.log('Total GSB user docs:', gsbSnapshot.size);

    // Show all GSB users
    gsbSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`- ${data.name || 'No name'} (${data.email})`);
    });

    process.exit(0);
}

countGSBUsers();