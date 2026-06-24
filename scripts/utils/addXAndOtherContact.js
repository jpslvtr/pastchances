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

async function addXAndOtherContactToAllUsers() {
    console.log('Starting to add X and Other contact fields to all users...');

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

            // Check if publicContact exists and already has x and other fields
            if (userData.publicContact &&
                userData.publicContact.hasOwnProperty('x') &&
                userData.publicContact.hasOwnProperty('other')) {
                console.log(`- ${userData.name || 'No name'} (${userData.email}) - x and other fields already exist`);
                skippedCount++;
                continue;
            }

            // If publicContact doesn't exist at all, create it with all fields
            if (!userData.publicContact) {
                const publicContact = {
                    cell: '',
                    instagram: '',
                    x: '',
                    linkedin: '',
                    other: '',
                    preferred: ''
                };

                batch.update(doc.ref, {
                    publicContact: publicContact,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                console.log(`✓ ${userData.name || 'No name'} (${userData.email}) - created publicContact with x and other`);
            } else {
                // publicContact exists but is missing x and/or other
                const updatedPublicContact = {
                    ...userData.publicContact,
                    x: userData.publicContact.x || '',
                    other: userData.publicContact.other || ''
                };

                batch.update(doc.ref, {
                    publicContact: updatedPublicContact,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                console.log(`✓ ${userData.name || 'No name'} (${userData.email}) - added x and other to existing publicContact`);
            }

            batchCount++;
            updatedCount++;

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
        console.log(`Skipped (already had x and other): ${skippedCount}`);
        console.log('\nMigration completed successfully.');

        process.exit(0);

    } catch (error) {
        console.error('Error adding x and other contact to users:', error);
        process.exit(1);
    }
}

// Run the migration
addXAndOtherContactToAllUsers();