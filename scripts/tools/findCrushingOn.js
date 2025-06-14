import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load service account key
const serviceAccount = JSON.parse(
    readFileSync(join(__dirname, '../../functions/src/serviceAccountKey.json'), 'utf8')
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'stanford-lastchances',
});

const db = admin.firestore();

const targetNames = ["Dru Nkansah"];

async function findCrushingOn() {
    const snapshot = await db.collection('users').get();

    targetNames.forEach(targetName => {
        let found = false;

        snapshot.forEach(doc => {
            const userName = doc.get('verifiedName') || '(Unnamed User)';

            if (userName === targetName) {
                found = true;
                const crushes = doc.get('crushes') || [];
                const matches = doc.get('matches') || [];
                const lockedCrushes = doc.get('lockedCrushes') || [];

                console.log(`\n👤 ${targetName} is crushing on:`);

                if (crushes.length === 0) {
                    console.log(`   No crushes yet`);
                } else {
                    crushes.forEach(crush => {
                        const isLocked = lockedCrushes.includes(crush);
                        const hasMatch = matches.some(match =>
                            (match.name && match.name === crush) || match === crush
                        );

                        let status = '';
                        if (hasMatch) {
                            status = ' 💕 (MATCHED!)';
                        } else if (isLocked) {
                            status = ' 🔒 (LOCKED)';
                        }

                        console.log(`   - ${crush}${status}`);
                    });
                }

                if (matches.length > 0) {
                    console.log(`\n🎉 ${targetName} has ${matches.length} match${matches.length > 1 ? 'es' : ''}:`);
                    matches.forEach(match => {
                        const matchName = match.name || match;
                        console.log(`   💕 ${matchName}`);
                    });
                }
            }
        });

        if (!found) {
            console.log(`❌ User "${targetName}" not found or has no verifiedName`);
        }
    });
}

findCrushingOn().catch(console.error);