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

async function cleanupNonGSBUsers() {
    try {
        console.log('🧹 Starting cleanup of non-GSB users...\n');

        // Users to delete (not in GSB class)
        const usersToDelete = [
            'rabl@stanford.edu',         // Vincent Rabl
            'stephyeh@stanford.edu',     // Steph Yeh  
            'gambeant@stanford.edu',     // Antoine Gamberini
            'nikhilkj@stanford.edu'      // Nikhil Jain
        ];

        // Users to update (fix name mismatches)
        const usersToUpdate = [
            {
                email: 'cgordong@stanford.edu',
                currentName: 'Carmen Gordon Gil',
                correctName: 'Carmen Gordon'
            },
            {
                email: 'dani2025@stanford.edu',
                currentName: 'Dani Camargo Carrillo',
                correctName: 'Daniela Camargo Carrillo'
            }
        ];

        // First, find these users in the database
        const usersSnapshot = await db.collection('users').get();
        const usersByEmail = new Map();

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            usersByEmail.set(userData.email, {
                uid: doc.id,
                ...userData
            });
        });

        // Delete non-GSB users
        console.log('🗑️ Deleting non-GSB users...');
        const deletePromises = [];

        for (const email of usersToDelete) {
            const user = usersByEmail.get(email);
            if (user) {
                console.log(`   - Deleting ${user.verifiedName || user.displayName} (${email})`);

                // Delete from users collection
                deletePromises.push(db.collection('users').doc(user.uid).delete());

                // Delete from takenNames if they have a verifiedName
                if (user.verifiedName) {
                    deletePromises.push(db.collection('takenNames').doc(user.verifiedName).delete());
                }
            } else {
                console.log(`   - User not found: ${email}`);
            }
        }

        await Promise.all(deletePromises);
        console.log(`✅ Deleted ${usersToDelete.length} non-GSB users\n`);

        // Update name mismatches
        console.log('✏️ Fixing name mismatches...');
        const updatePromises = [];

        for (const { email, currentName, correctName } of usersToUpdate) {
            const user = usersByEmail.get(email);
            if (user && user.verifiedName === currentName) {
                console.log(`   - Updating ${currentName} -> ${correctName} (${email})`);

                // Update user document
                updatePromises.push(
                    db.collection('users').doc(user.uid).update({
                        verifiedName: correctName,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        nameFixed: true,
                        nameFix: {
                            from: currentName,
                            to: correctName,
                            fixedAt: admin.firestore.FieldValue.serverTimestamp()
                        }
                    })
                );

                // Update takenNames - delete old, create new
                updatePromises.push(db.collection('takenNames').doc(currentName).delete());
                updatePromises.push(
                    db.collection('takenNames').doc(correctName).set({
                        takenBy: user.uid,
                        takenAt: admin.firestore.FieldValue.serverTimestamp(),
                        email: user.email,
                        nameFixed: true
                    })
                );
            } else if (user) {
                console.log(`   - User found but name doesn't match: ${user.verifiedName} vs ${currentName}`);
            } else {
                console.log(`   - User not found: ${email}`);
            }
        }

        await Promise.all(updatePromises);
        console.log(`✅ Fixed ${usersToUpdate.length} name mismatches\n`);

        // Final verification
        console.log('📊 Final verification...');
        const finalSnapshot = await db.collection('users').get();
        console.log(`Users remaining: ${finalSnapshot.size}`);

        console.log('\n🎉 Cleanup completed!');
        console.log('Next step: Deploy the updated auth validation to prevent future issues.');

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    } finally {
        process.exit(0);
    }
}

cleanupNonGSBUsers();