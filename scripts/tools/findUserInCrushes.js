import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load service account key
const serviceAccount = JSON.parse(
    readFileSync(join(__dirname, '../functions/src/serviceAccountKey.json'), 'utf8')
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'stanford-lastchances',
});

const db = admin.firestore();

const targetNames = ["Gabriela Tafur Nader"];

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