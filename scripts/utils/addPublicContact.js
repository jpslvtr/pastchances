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

async function addPublicContactToAllUsers() {
    console.log('Starting to add publicContact field to all users...');

    try {
        const usersSnapshot = await db.collection('users').get();
        const totalUsers = usersSnapshot.size;
        console.log(`Found ${totalUsers} users to update\n`);

        let updatedCount = 0;
        let skippedCount = 0;
        const batch = db.batch();
        let batchCount = 0;
        const BATCH_LIMIT = 500;

        for (const doc of usersSnapshot.docs) {
            const userData = doc.data();

            // Check if publicContact already exists
            if (userData.publicContact) {
                console.log(`- ${userData.name || 'No name'} (${userData.email}) - publicContact already exists`);
                skippedCount++;
                continue;
            }

            // Add publicContact field with empty strings
            const publicContact = {
                cell: '',
                instagram: '',
                linkedin: '',
                preferred: ''
            };

            batch.update(doc.ref, {
                publicContact: publicContact,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            batchCount++;
            updatedCount++;
            console.log(`✓ ${userData.name || 'No name'} (${userData.email}) - added publicContact`);

            // Commit batch if we hit the limit
            if (batchCount === BATCH_LIMIT) {
                console.log('\nCommitting batch...');
                await batch.commit();
                batchCount = 0;
            }
        }

        // Commit remaining updates
        if (batchCount > 0) {
            console.log('\nCommitting final batch...');
            await batch.commit();
        }

        console.log('\n=== Summary ===');
        console.log(`Total users: ${totalUsers}`);
        console.log(`Updated: ${updatedCount}`);
        console.log(`Skipped (already had publicContact): ${skippedCount}`);
        console.log('\nMigration completed successfully.');

        process.exit(0);

    } catch (error) {
        console.error('Error adding publicContact to users:', error);
        process.exit(1);
    }
}

// Run the migration
addPublicContactToAllUsers();