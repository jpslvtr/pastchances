import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';

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

async function restoreUserData() {
    const targetClass = process.argv[2] || 'gsb'; // Allow class to be specified as argument

    try {
        // Find the most recent backup file for the specified class
        const files = readdirSync(__dirname);
        const backupFiles = files.filter(f =>
            f.startsWith(`user-backup-${targetClass}-`) && f.endsWith('.json')
        );

        // Also check for old format backups if no class-specific ones found
        if (backupFiles.length === 0) {
            const oldBackupFiles = files.filter(f =>
                f.startsWith('user-backup-') && f.endsWith('.json') && !f.includes('-gsb-') && !f.includes('-undergrad-')
            );

            if (oldBackupFiles.length > 0) {
                console.log(`⚠️ No ${targetClass.toUpperCase()}-specific backups found. Checking old format backups...`);
                backupFiles.push(...oldBackupFiles);
            }
        }

        if (backupFiles.length === 0) {
            console.log(`❌ No backup files found for ${targetClass.toUpperCase()}. Run backup-user-data.js first.`);
            console.log(`   Usage: node backup-user-data.js ${targetClass}`);
            return;
        }

        // Sort by timestamp (newest first)
        backupFiles.sort((a, b) => {
            const timestampA = parseInt(a.match(/(\d+)\.json$/)?.[1] || '0');
            const timestampB = parseInt(b.match(/(\d+)\.json$/)?.[1] || '0');
            return timestampB - timestampA;
        });

        const latestBackup = backupFiles[0];
        const backupPath = join(__dirname, latestBackup);

        console.log(`📂 Loading backup from: ${latestBackup}`);

        const backupData = JSON.parse(readFileSync(backupPath, 'utf8'));
        const targetEmail = backupData.target.email;
        const backupClass = backupData.target.userClass || targetClass;

        console.log(`🎯 Restoring ${backupClass.toUpperCase()} data for: ${backupData.target.name} (${targetEmail})`);

        // Initialize restoredCrushers at the top level
        let restoredCrushers = 0;

        // For test user, handle class-specific document IDs
        if (targetEmail === 'jpark22@stanford.edu') {
            const testUserDocs = await findTestUserDocuments(targetEmail);

            // Find the current document for the target class
            const targetDoc = testUserDocs.find(doc =>
                (doc.data.userClass || 'gsb') === backupClass
            );

            if (!targetDoc) {
                console.log(`❌ ${backupClass.toUpperCase()} user document not found. Please sign up first, then run this script.`);
                console.log('   Available documents:', testUserDocs.map(doc =>
                    `${doc.id} (${doc.data.userClass || 'gsb'})`
                ).join(', ') || 'None');
                return;
            }

            const currentUserId = targetDoc.id;
            console.log(`✅ Found current ${backupClass.toUpperCase()} user document: ${currentUserId}`);

            // Restore user's own data
            console.log(`🔄 Restoring ${backupClass.toUpperCase()} user crushes, matches, and locked crushes...`);

            await db.collection('users').doc(currentUserId).update({
                crushes: backupData.userCrushes,
                matches: backupData.userMatches,
                lockedCrushes: backupData.userLockedCrushes,
                crushCount: backupData.userCrushCount,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`✅ Restored ${backupData.userCrushes.length} crushes, ${backupData.userMatches.length} matches`);

            // Restore crushes FROM other people TO this user (only same class)
            console.log(`🔄 Restoring crushes from other ${backupClass.toUpperCase()} users...`);

            for (const crusher of backupData.crushers) {
                try {
                    // Find the crusher's current document
                    const crusherSnapshot = await db.collection('users').where('email', '==', crusher.email).get();

                    if (!crusherSnapshot.empty) {
                        // For test user crushers, find the correct class-specific document
                        let targetCrusherDoc = null;

                        if (crusher.email === 'jpark22@stanford.edu') {
                            // This is also a test user, find their class-specific document
                            for (const doc of crusherSnapshot.docs) {
                                const docData = doc.data();
                                if ((docData.userClass || 'gsb') === backupClass) {
                                    targetCrusherDoc = doc;
                                    break;
                                }
                            }
                        } else {
                            // Regular user, check if they're in the same class
                            for (const doc of crusherSnapshot.docs) {
                                const docData = doc.data();
                                if ((docData.userClass || 'gsb') === backupClass) {
                                    targetCrusherDoc = doc;
                                    break;
                                }
                            }
                        }

                        if (targetCrusherDoc) {
                            const currentCrusherData = targetCrusherDoc.data();
                            const currentCrushes = currentCrusherData.crushes || [];

                            // Add the target user's name to their crushes if not already there
                            if (!currentCrushes.includes(backupData.target.name)) {
                                const updatedCrushes = [...currentCrushes, backupData.target.name];

                                await db.collection('users').doc(targetCrusherDoc.id).update({
                                    crushes: updatedCrushes,
                                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                                });

                                restoredCrushers++;
                                console.log(`  ✅ Restored crush from ${crusher.name} (${backupClass.toUpperCase()})`);
                            } else {
                                console.log(`  ⚠️ ${crusher.name} already has you in their crushes`);
                            }
                        } else {
                            console.log(`  ❌ Could not find ${backupClass.toUpperCase()} document for: ${crusher.name} (${crusher.email})`);
                        }
                    } else {
                        console.log(`  ❌ Could not find user: ${crusher.name} (${crusher.email})`);
                    }
                } catch (error) {
                    console.error(`  ❌ Error restoring crush from ${crusher.name}:`, error.message);
                }
            }

            console.log(`✅ Restored crushes from ${restoredCrushers} ${backupClass.toUpperCase()} users`);

        } else {
            // Regular user logic (original code)
            const usersSnapshot = await db.collection('users').where('email', '==', targetEmail).get();

            if (usersSnapshot.empty) {
                console.log('❌ User not found. Please sign up first, then run this script.');
                return;
            }

            const userDoc = usersSnapshot.docs[0];
            const currentUserId = userDoc.id;

            console.log(`✅ Found current user document: ${currentUserId}`);

            // Restore user's own data
            console.log('🔄 Restoring user crushes, matches, and locked crushes...');

            await db.collection('users').doc(currentUserId).update({
                crushes: backupData.userCrushes,
                matches: backupData.userMatches,
                lockedCrushes: backupData.userLockedCrushes,
                crushCount: backupData.userCrushCount,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`✅ Restored ${backupData.userCrushes.length} crushes, ${backupData.userMatches.length} matches`);

            // Restore crushes FROM other people TO this user
            console.log('🔄 Restoring crushes from other users...');

            for (const crusher of backupData.crushers) {
                try {
                    const crusherSnapshot = await db.collection('users').where('email', '==', crusher.email).get();

                    if (!crusherSnapshot.empty) {
                        const crusherDoc = crusherSnapshot.docs[0];
                        const currentCrusherData = crusherDoc.data();
                        const currentCrushes = currentCrusherData.crushes || [];

                        if (!currentCrushes.includes(backupData.target.name)) {
                            const updatedCrushes = [...currentCrushes, backupData.target.name];

                            await db.collection('users').doc(crusherDoc.id).update({
                                crushes: updatedCrushes,
                                updatedAt: admin.firestore.FieldValue.serverTimestamp()
                            });

                            restoredCrushers++;
                            console.log(`  ✅ Restored crush from ${crusher.name}`);
                        } else {
                            console.log(`  ⚠️ ${crusher.name} already has you in their crushes`);
                        }
                    } else {
                        console.log(`  ❌ Could not find user: ${crusher.name} (${crusher.email})`);
                    }
                } catch (error) {
                    console.error(`  ❌ Error restoring crush from ${crusher.name}:`, error.message);
                }
            }

            console.log(`✅ Restored crushes from ${restoredCrushers} users`);
        }

        // Trigger recalculation to fix matches and crush counts
        console.log('🔄 Triggering match recalculation...');

        try {
            const response = await fetch(`https://us-central1-stanford-lastchances.cloudfunctions.net/recalculateAllMatches`, {
                method: 'POST'
            });

            if (response.ok) {
                console.log('✅ Successfully triggered match recalculation');
            } else {
                console.log('⚠️ Could not trigger automatic recalculation, but data is restored');
            }
        } catch (error) {
            console.log('⚠️ Could not trigger automatic recalculation, but data is restored');
        }

        console.log(`\n🎉 ${backupClass.toUpperCase()} RESTORATION COMPLETE!`);
        console.log('\n📊 SUMMARY:');
        console.log(`Restored crushes sent: ${backupData.userCrushes.length}`);
        console.log(`Restored matches: ${backupData.userMatches.length}`);
        console.log(`Restored locked crushes: ${backupData.userLockedCrushes.length}`);
        console.log(`Restored crushers: ${restoredCrushers}/${backupData.crushers.length}`);
        console.log(`\nYour ${backupClass.toUpperCase()} account should now be back to its previous state!`);

    } catch (error) {
        console.error('❌ Error restoring user data:', error);
    } finally {
        process.exit(0);
    }
}

restoreUserData();