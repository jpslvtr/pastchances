import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
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

async function backupUserData() {
    const targetEmail = 'jpark22@stanford.edu';

    try {
        console.log(`🔍 Looking up user with email: ${targetEmail}`);

        // Find user by email
        const usersSnapshot = await db.collection('users').where('email', '==', targetEmail).get();

        if (usersSnapshot.empty) {
            console.log('❌ User not found');
            return;
        }

        const userDoc = usersSnapshot.docs[0];
        const userData = userDoc.data();
        const userId = userDoc.id;

        console.log(`✅ Found user: ${userData.name} (${userId})`);

        // Get all users to find crushers
        console.log('🔍 Scanning all users to find who is crushing on you...');
        const allUsersSnapshot = await db.collection('users').get();
        const crushers = [];

        allUsersSnapshot.forEach(doc => {
            const data = doc.data();
            const userCrushes = data.crushes || [];

            if (userCrushes.includes(userData.name)) {
                crushers.push({
                    uid: doc.id,
                    email: data.email,
                    name: data.name,
                    crushes: userCrushes
                });
            }
        });

        const backupData = {
            target: {
                email: targetEmail,
                name: userData.name,
                uid: userId
            },
            userCrushes: userData.crushes || [],
            userMatches: userData.matches || [],
            userLockedCrushes: userData.lockedCrushes || [],
            userCrushCount: userData.crushCount || 0,
            crushers: crushers,
            timestamp: new Date().toISOString()
        };

        // Save backup to file
        const backupPath = join(__dirname, `user-backup-${Date.now()}.json`);
        writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

        console.log('\n📊 BACKUP SUMMARY:');
        console.log(`Target User: ${userData.name} (${targetEmail})`);
        console.log(`Crushes Sent: ${(userData.crushes || []).length}`);
        console.log(`  - ${(userData.crushes || []).join(', ')}`);
        console.log(`Matches: ${(userData.matches || []).length}`);
        if (userData.matches && userData.matches.length > 0) {
            userData.matches.forEach(match => {
                console.log(`  - ${match.name} (${match.email})`);
            });
        }
        console.log(`Locked Crushes: ${(userData.lockedCrushes || []).length}`);
        console.log(`  - ${(userData.lockedCrushes || []).join(', ')}`);
        console.log(`People Crushing on You: ${crushers.length}`);
        crushers.forEach(crusher => {
            console.log(`  - ${crusher.name} (${crusher.email})`);
        });

        console.log(`\n💾 Backup saved to: ${backupPath}`);
        console.log('\n🚨 Ready for testing! You can now:');
        console.log('1. Delete your user document from Firestore');
        console.log('2. Delete your auth record from Firebase Auth');
        console.log('3. Test the sign-up process');
        console.log('4. Run the restore script to get your data back');

    } catch (error) {
        console.error('❌ Error backing up user data:', error);
    } finally {
        process.exit(0);
    }
}

backupUserData();