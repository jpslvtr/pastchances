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

async function findCrushesOnAhmad() {
    try {
        console.log('🔍 Finding who has crushed on Ahmad Nasir...\n');

        // Get all users
        const usersSnapshot = await db.collection('users').get();
        const crushersOnAhmad = [];

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            const userName = userData.verifiedName || userData.displayName || userData.email || '(Unnamed User)';
            const userCrushes = userData.crushes || [];

            // Check if this user has crushed on Ahmad Nasir
            if (userCrushes.includes('Ahmad Nasir')) {
                crushersOnAhmad.push({
                    name: userName,
                    email: userData.email,
                    uid: doc.id,
                    hasVerifiedName: !!(userData.verifiedName && userData.verifiedName.trim()),
                    totalCrushes: userCrushes.length,
                    allCrushes: userCrushes
                });
            }
        });

        console.log('='.repeat(80));
        console.log('USERS WHO HAVE CRUSHED ON AHMAD NASIR');
        console.log('='.repeat(80));

        if (crushersOnAhmad.length === 0) {
            console.log('✅ No one has crushed on Ahmad Nasir.');
        } else {
            console.log(`Found ${crushersOnAhmad.length} user(s) who have crushed on Ahmad Nasir:\n`);

            crushersOnAhmad.forEach((crusher, index) => {
                console.log(`${index + 1}. ${crusher.name}`);
                console.log(`   Email: ${crusher.email}`);
                console.log(`   UID: ${crusher.uid}`);
                console.log(`   Has verified name: ${crusher.hasVerifiedName ? 'Yes' : 'No'}`);
                console.log(`   Total crushes: ${crusher.totalCrushes}`);
                console.log(`   All crushes: ${crusher.allCrushes.join(', ')}`);
                console.log('');
            });

            console.log('='.repeat(80));
            console.log('RECOMMENDED ACTIONS:');
            console.log('1. Contact the user(s) above to let them know Ahmad is Class of 2026');
            console.log('2. Remove Ahmad Nasir from your names.ts file');
            console.log('3. The users can then update their crushes to remove Ahmad');
            console.log('4. Or you can run a cleanup script to automatically remove Ahmad from everyone\'s crushes');
        }

        console.log('\n' + '='.repeat(80));

    } catch (error) {
        console.error('❌ Error finding crushes on Ahmad:', error);
    } finally {
        process.exit(0);
    }
}

findCrushesOnAhmad();