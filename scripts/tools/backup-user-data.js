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

// Helper function to get the correct document ID for test user
function getUserDocumentId(email, userClass) {
    if (email === 'jpark22@stanford.edu') {
        // For test user, determine the base UID and add class suffix
        // We'll need to find the base UID by checking existing documents
        return userClass === 'gsb' ? '_gsb' : '_undergrad'; // Will be completed later
    }
    return null; // Regular users use their regular UID
}

async function findTestUserDocuments(targetEmail) {
    console.log(`🔍 Looking for all documents for test user: ${targetEmail}`);

    // Get all users to find documents matching the test user email
    const allUsersSnapshot = await db.collection('users').get();
    const testUserDocs = [];

    allUsersSnapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.email === targetEmail) {
            testUserDocs.push({
                id: doc.id,
                data: userData
            });
        }
    });

    return testUserDocs;
}

async function backupUserData() {
    const targetEmail = 'jpark22@stanford.edu';
    const targetClass = process.argv[2] || 'gsb'; // Allow class to be specified as argument

    try {
        console.log(`🔍 Looking up ${targetClass.toUpperCase()} user with email: ${targetEmail}`);

        // For test user, find all their documents
        if (targetEmail === 'jpark22@stanford.edu') {
            const testUserDocs = await findTestUserDocuments(targetEmail);

            if (testUserDocs.length === 0) {
                console.log('❌ No user documents found');
                return;
            }

            console.log(`✅ Found ${testUserDocs.length} user document(s):`);
            testUserDocs.forEach(doc => {
                console.log(`   - ${doc.id} (${doc.data.userClass || 'gsb'})`);
            });

            // Find the specific class document
            const targetDoc = testUserDocs.find(doc =>
                (doc.data.userClass || 'gsb') === targetClass
            );

            if (!targetDoc) {
                console.log(`❌ No ${targetClass.toUpperCase()} document found. Available classes:`,
                    testUserDocs.map(doc => doc.data.userClass || 'gsb').join(', '));
                return;
            }

            const userData = targetDoc.data;
            const userId = targetDoc.id;

            console.log(`✅ Found ${targetClass.toUpperCase()} user: ${userData.name} (${userId})`);

            // Get all users to find crushers (only from same class)
            console.log(`🔍 Scanning all ${targetClass.toUpperCase()} users to find who is crushing on you...`);
            const allUsersSnapshot = await db.collection('users').get();
            const crushers = [];

            allUsersSnapshot.forEach(doc => {
                const data = doc.data();
                const userClass = data.userClass || 'gsb';

                // Only check users from the same class
                if (userClass === targetClass) {
                    const userCrushes = data.crushes || [];

                    if (userCrushes.includes(userData.name)) {
                        crushers.push({
                            uid: doc.id,
                            email: data.email,
                            name: data.name,
                            userClass: userClass,
                            crushes: userCrushes
                        });
                    }
                }
            });

            const backupData = {
                target: {
                    email: targetEmail,
                    name: userData.name,
                    uid: userId,
                    userClass: targetClass
                },
                userCrushes: userData.crushes || [],
                userMatches: userData.matches || [],
                userLockedCrushes: userData.lockedCrushes || [],
                userCrushCount: userData.crushCount || 0,
                crushers: crushers,
                timestamp: new Date().toISOString(),
                classSpecific: true // Flag to indicate this is a class-specific backup
            };

            // Save backup to file with class suffix
            const backupPath = join(__dirname, `user-backup-${targetClass}-${Date.now()}.json`);
            writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

            console.log(`\n📊 ${targetClass.toUpperCase()} BACKUP SUMMARY:`);
            console.log(`Target User: ${userData.name} (${targetEmail}) - ${targetClass.toUpperCase()}`);
            console.log(`Document ID: ${userId}`);
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
            console.log(`People Crushing on You (${targetClass.toUpperCase()}): ${crushers.length}`);
            crushers.forEach(crusher => {
                console.log(`  - ${crusher.name} (${crusher.email})`);
            });

            console.log(`\n💾 Backup saved to: ${backupPath}`);
            console.log(`\n🚨 Ready for testing! You can now:`);
            console.log(`1. Delete your ${targetClass.toUpperCase()} user document from Firestore (${userId})`);
            console.log(`2. Test the sign-up process for ${targetClass.toUpperCase()}`);
            console.log(`3. Run the restore script to get your data back:`);
            console.log(`   node restore-user-data.js ${targetClass}`);

        } else {
            // Regular user logic (original code for non-test users)
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
        }

    } catch (error) {
        console.error('❌ Error backing up user data:', error);
    } finally {
        process.exit(0);
    }
}

backupUserData();