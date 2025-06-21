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

async function migrateToSingleName() {
    try {
        console.log('🔄 Starting migration to single name field...');

        const usersSnapshot = await db.collection('users').get();
        const batch = db.batch();
        let migratedCount = 0;

        usersSnapshot.forEach(doc => {
            const userData = doc.data();

            // Determine the best name to use
            let finalName = userData.name;

            if (!finalName || finalName.trim() === '') {
                // Try verifiedName first, then displayName
                finalName = userData.verifiedName || userData.displayName || '';
            }

            if (finalName && finalName.trim() !== '') {
                const userRef = db.collection('users').doc(doc.id);

                // Prepare update data
                const updateData = {
                    name: finalName,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };

                // Remove legacy fields if they exist
                if (userData.displayName !== undefined) {
                    updateData.displayName = admin.firestore.FieldValue.delete();
                }
                if (userData.verifiedName !== undefined) {
                    updateData.verifiedName = admin.firestore.FieldValue.delete();
                }

                batch.update(userRef, updateData);
                migratedCount++;

                console.log(`✅ Migrating user ${userData.email}: "${finalName}"`);
            } else {
                console.log(`⚠️ User ${userData.email} has no name - skipping`);
            }
        });

        await batch.commit();
        console.log(`🎉 Migration completed! Migrated ${migratedCount} users.`);

        // Clean up takenNames collection
        console.log('🗑️ Cleaning up takenNames collection...');
        const takenNamesSnapshot = await db.collection('takenNames').get();

        if (!takenNamesSnapshot.empty) {
            const deleteBatch = db.batch();
            takenNamesSnapshot.docs.forEach(doc => {
                deleteBatch.delete(doc.ref);
            });
            await deleteBatch.commit();
            console.log(`✅ Deleted ${takenNamesSnapshot.size} documents from takenNames collection`);
        }

        console.log('🎉 Full migration completed successfully!');

    } catch (error) {
        console.error('❌ Error during migration:', error);
    } finally {
        process.exit(0);
    }
}

migrateToSingleName();