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

async function addProfileFields() {
    console.log('Starting to add profile fields...');

    try {
        const usersSnapshot = await db.collection('users').get();
        console.log(`Found ${usersSnapshot.size} users`);

        let updated = 0;
        let skipped = 0;

        const batch = db.batch();
        let batchCount = 0;
        const BATCH_LIMIT = 500;

        for (const doc of usersSnapshot.docs) {
            const userData = doc.data();

            // Only add fields if they don't exist
            const needsUpdate = !userData.hasOwnProperty('location') || !userData.hasOwnProperty('about');

            if (needsUpdate) {
                const updates = {};

                if (!userData.hasOwnProperty('location')) {
                    updates.location = '';
                }

                if (!userData.hasOwnProperty('about')) {
                    updates.about = '';
                }

                batch.update(doc.ref, updates);
                updated++;
                batchCount++;
                console.log(`✓ Will update: ${userData.name} (${doc.id})`);

                // Commit batch if we hit the limit
                if (batchCount === BATCH_LIMIT) {
                    console.log('\nCommitting batch...');
                    await batch.commit();
                    batchCount = 0;
                }
            } else {
                skipped++;
            }
        }

        // Commit remaining updates
        if (batchCount > 0) {
            console.log('\nCommitting final batch...');
            await batch.commit();
        }

        console.log('\n=== Summary ===');
        console.log(`✅ Successfully updated ${updated} users`);
        console.log(`ℹ️  Skipped ${skipped} users (already have fields)`);
        console.log('\nDone!');

    } catch (error) {
        console.error('❌ Error adding profile fields:', error);
        process.exit(1);
    }

    process.exit(0);
}

addProfileFields();