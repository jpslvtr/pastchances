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

async function restoreUserData() {
    try {
        // Find the most recent backup file
        const files = readdirSync(__dirname);
        const backupFiles = files.filter(f => f.startsWith('user-backup-') && f.endsWith('.json'));

        if (backupFiles.length === 0) {
            console.log('❌ No backup files found. Run backup-user-data.js first.');
            return;
        }

        // Sort by timestamp (newest first)
        backupFiles.sort((a, b) => {
            const timestampA = parseInt(a.match(/user-backup-(\d+)\.json/)[1]);
            const timestampB = parseInt(b.match(/user-backup-(\d+)\.json/)[1]);
            return timestampB - timestampA;
        });

        const latestBackup = backupFiles[0];
        const backupPath = join(__dirname, latestBackup);

        console.log(`📂 Loading backup from: ${latestBackup}`);

        const backupData = JSON.parse(readFileSync(backupPath, 'utf8'));
        const targetEmail = backupData.target.email;

        console.log(`🎯 Restoring data for: ${backupData.target.name} (${targetEmail})`);

        // Find the current user document (should exist after sign-up test)
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

        let restoredCrushers = 0;

        for (const crusher of backupData.crushers) {
            try {
                // Find the crusher's current document
                const crusherSnapshot = await db.collection('users').where('email', '==', crusher.email).get();

                if (!crusherSnapshot.empty) {
                    const crusherDoc = crusherSnapshot.docs[0];
                    const currentCrusherData = crusherDoc.data();
                    const currentCrushes = currentCrusherData.crushes || [];

                    // Add the target user's name to their crushes if not already there
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

        // Trigger recalculation to fix matches and crush counts
        console.log('🔄 Triggering match recalculation...');

        // We'll call the backend function to recalculate everything
        // This ensures all matches and crush counts are properly updated
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

        console.log('\n🎉 RESTORATION COMPLETE!');
        console.log('\n📊 SUMMARY:');
        console.log(`Restored crushes sent: ${backupData.userCrushes.length}`);
        console.log(`Restored matches: ${backupData.userMatches.length}`);
        console.log(`Restored locked crushes: ${backupData.userLockedCrushes.length}`);
        console.log(`Restored crushers: ${restoredCrushers}/${backupData.crushers.length}`);
        console.log(`\nYour account should now be back to its previous state!`);

    } catch (error) {
        console.error('❌ Error restoring user data:', error);
    } finally {
        process.exit(0);
    }
}

restoreUserData();