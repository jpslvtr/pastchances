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

async function comprehensiveFix() {
    try {
        console.log('🔧 Starting comprehensive fix for users/takenNames discrepancies...\n');

        // Get all data
        const usersSnapshot = await db.collection('users').get();
        const takenNamesSnapshot = await db.collection('takenNames').get();

        console.log(`Initial counts - Users: ${usersSnapshot.size}, TakenNames: ${takenNamesSnapshot.size}`);
        console.log(`Initial discrepancy: ${usersSnapshot.size - takenNamesSnapshot.size}\n`);

        // Build data structures
        const allUsers = new Map();
        const takenNamesMap = new Map();
        const takenByUidMap = new Map();

        // Process users
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            allUsers.set(doc.id, {
                uid: doc.id,
                email: userData.email,
                displayName: userData.displayName,
                verifiedName: userData.verifiedName,
                crushes: userData.crushes || [],
                lockedCrushes: userData.lockedCrushes || [],
                matches: userData.matches || [],
                crushCount: userData.crushCount || 0
            });
        });

        // Process takenNames
        takenNamesSnapshot.forEach(doc => {
            const data = doc.data();
            const nameId = doc.id;
            takenNamesMap.set(nameId, {
                takenBy: data.takenBy,
                email: data.email,
                takenAt: data.takenAt
            });
            takenByUidMap.set(data.takenBy, nameId);
        });

        // ISSUE 1: Users without verifiedName
        console.log('1️⃣ Checking users without verifiedName...');
        const usersWithoutVerifiedName = [];
        for (const [uid, user] of allUsers) {
            if (!user.verifiedName || user.verifiedName.trim() === '') {
                usersWithoutVerifiedName.push(user);
            }
        }
        console.log(`   Found ${usersWithoutVerifiedName.length} users without verifiedName`);
        usersWithoutVerifiedName.forEach(user => {
            console.log(`   - ${user.email} (${user.uid})`);
        });

        // ISSUE 2: Users with verifiedName but no takenName document
        console.log('\n2️⃣ Checking users missing takenName documents...');
        const usersMissingTakenNames = [];
        for (const [uid, user] of allUsers) {
            if (user.verifiedName && user.verifiedName.trim() !== '') {
                if (!takenNamesMap.has(user.verifiedName)) {
                    usersMissingTakenNames.push(user);
                }
            }
        }
        console.log(`   Found ${usersMissingTakenNames.length} users missing takenName documents`);

        // Create missing takenName documents
        if (usersMissingTakenNames.length > 0) {
            console.log('   Creating missing takenName documents...');
            const batch1 = db.batch();

            usersMissingTakenNames.forEach(user => {
                console.log(`   - Creating takenName for "${user.verifiedName}" -> ${user.email}`);
                const takenNameRef = db.collection('takenNames').doc(user.verifiedName);
                batch1.set(takenNameRef, {
                    takenBy: user.uid,
                    takenAt: admin.firestore.FieldValue.serverTimestamp(),
                    email: user.email
                });
            });

            await batch1.commit();
            console.log(`   ✅ Created ${usersMissingTakenNames.length} missing takenName documents`);
        }

        // ISSUE 3: TakenNames pointing to wrong UIDs
        console.log('\n3️⃣ Checking takenNames with wrong UID pointers...');
        const wrongUidPointers = [];
        for (const [uid, user] of allUsers) {
            if (user.verifiedName && user.verifiedName.trim() !== '') {
                const takenNameInfo = takenNamesMap.get(user.verifiedName);
                if (takenNameInfo && takenNameInfo.takenBy !== uid) {
                    wrongUidPointers.push({
                        user: user,
                        takenNameInfo: takenNameInfo,
                        correctUid: uid,
                        wrongUid: takenNameInfo.takenBy
                    });
                }
            }
        }
        console.log(`   Found ${wrongUidPointers.length} takenNames with wrong UID pointers`);

        // Fix wrong UID pointers
        if (wrongUidPointers.length > 0) {
            console.log('   Fixing wrong UID pointers...');
            const batch2 = db.batch();

            wrongUidPointers.forEach(({ user, takenNameInfo, correctUid, wrongUid }) => {
                console.log(`   - Fixing "${user.verifiedName}": ${wrongUid} -> ${correctUid} (${user.email})`);
                const takenNameRef = db.collection('takenNames').doc(user.verifiedName);
                batch2.update(takenNameRef, {
                    takenBy: correctUid,
                    email: user.email,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    previousTakenBy: wrongUid,
                    fixedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });

            await batch2.commit();
            console.log(`   ✅ Fixed ${wrongUidPointers.length} wrong UID pointers`);
        }

        // ISSUE 4: Duplicate verifiedNames (multiple users with same name)
        console.log('\n4️⃣ Checking for duplicate verifiedNames...');
        const verifiedNameCounts = new Map();
        for (const [uid, user] of allUsers) {
            if (user.verifiedName && user.verifiedName.trim() !== '') {
                if (!verifiedNameCounts.has(user.verifiedName)) {
                    verifiedNameCounts.set(user.verifiedName, []);
                }
                verifiedNameCounts.get(user.verifiedName).push(user);
            }
        }

        const duplicateNames = [];
        for (const [name, users] of verifiedNameCounts) {
            if (users.length > 1) {
                duplicateNames.push({ name, users });
            }
        }

        if (duplicateNames.length > 0) {
            console.log(`   Found ${duplicateNames.length} names with multiple users:`);
            duplicateNames.forEach(({ name, users }) => {
                console.log(`   - "${name}" claimed by:`);
                users.forEach(user => {
                    console.log(`     * ${user.email} (${user.uid})`);
                });
                console.log(`   ⚠️  MANUAL INTERVENTION REQUIRED: Determine which user should keep this name`);
            });
        } else {
            console.log('   ✅ No duplicate verifiedNames found');
        }

        // ISSUE 5: Orphaned takenNames (pointing to non-existent users)
        console.log('\n5️⃣ Checking for orphaned takenNames...');
        const orphanedTakenNames = [];
        for (const [name, takenNameInfo] of takenNamesMap) {
            if (!allUsers.has(takenNameInfo.takenBy)) {
                orphanedTakenNames.push({ name, takenNameInfo });
            }
        }

        if (orphanedTakenNames.length > 0) {
            console.log(`   Found ${orphanedTakenNames.length} orphaned takenNames:`);
            console.log('   Removing orphaned takenNames...');

            const batch3 = db.batch();
            orphanedTakenNames.forEach(({ name, takenNameInfo }) => {
                console.log(`   - Removing "${name}" (pointed to non-existent user ${takenNameInfo.takenBy})`);
                const takenNameRef = db.collection('takenNames').doc(name);
                batch3.delete(takenNameRef);
            });

            await batch3.commit();
            console.log(`   ✅ Removed ${orphanedTakenNames.length} orphaned takenNames`);
        } else {
            console.log('   ✅ No orphaned takenNames found');
        }

        // ISSUE 6: Users with multiple takenNames
        console.log('\n6️⃣ Checking for users with multiple takenNames...');
        const uidCounts = new Map();
        for (const [name, takenNameInfo] of takenNamesMap) {
            const uid = takenNameInfo.takenBy;
            if (!uidCounts.has(uid)) {
                uidCounts.set(uid, []);
            }
            uidCounts.get(uid).push(name);
        }

        const usersWithMultipleTakenNames = [];
        for (const [uid, names] of uidCounts) {
            if (names.length > 1) {
                const user = allUsers.get(uid);
                usersWithMultipleTakenNames.push({ user, names });
            }
        }

        if (usersWithMultipleTakenNames.length > 0) {
            console.log(`   Found ${usersWithMultipleTakenNames.length} users with multiple takenNames:`);

            const batch4 = db.batch();
            usersWithMultipleTakenNames.forEach(({ user, names }) => {
                console.log(`   - ${user.email} has takenNames: ${names.join(', ')}`);
                console.log(`     Current verifiedName: "${user.verifiedName}"`);

                // Keep only the takenName that matches current verifiedName, remove others
                names.forEach(name => {
                    if (name !== user.verifiedName) {
                        console.log(`     Removing extra takenName: "${name}"`);
                        const takenNameRef = db.collection('takenNames').doc(name);
                        batch4.delete(takenNameRef);
                    }
                });
            });

            await batch4.commit();
            console.log(`   ✅ Cleaned up multiple takenNames`);
        } else {
            console.log('   ✅ No users with multiple takenNames found');
        }

        // Final verification
        console.log('\n🔍 Final verification...');
        const finalUsersSnapshot = await db.collection('users').get();
        const finalTakenNamesSnapshot = await db.collection('takenNames').get();

        console.log(`Final counts - Users: ${finalUsersSnapshot.size}, TakenNames: ${finalTakenNamesSnapshot.size}`);
        console.log(`Final discrepancy: ${finalUsersSnapshot.size - finalTakenNamesSnapshot.size}`);

        // Calculate expected discrepancy (users without verifiedName)
        const expectedDiscrepancy = usersWithoutVerifiedName.length;
        const actualDiscrepancy = finalUsersSnapshot.size - finalTakenNamesSnapshot.size;

        if (actualDiscrepancy === expectedDiscrepancy) {
            console.log(`✅ SUCCESS! Discrepancy matches expected value (${expectedDiscrepancy} users without verifiedName)`);
        } else {
            console.log(`⚠️  Unexpected discrepancy: Expected ${expectedDiscrepancy}, Got ${actualDiscrepancy}`);
        }

        console.log('\n📊 SUMMARY:');
        console.log(`   Users without verifiedName: ${usersWithoutVerifiedName.length} (expected)`);
        console.log(`   Missing takenNames created: ${usersMissingTakenNames.length}`);
        console.log(`   Wrong UID pointers fixed: ${wrongUidPointers.length}`);
        console.log(`   Duplicate names found: ${duplicateNames.length} (manual intervention needed)`);
        console.log(`   Orphaned takenNames removed: ${orphanedTakenNames.length}`);
        console.log(`   Multiple takenNames cleaned: ${usersWithMultipleTakenNames.length}`);

        if (duplicateNames.length > 0) {
            console.log('\n⚠️  MANUAL ACTION REQUIRED:');
            console.log('   Some users have selected the same verifiedName.');
            console.log('   You need to manually determine which user should keep each name');
            console.log('   and clear the verifiedName for the others so they can re-select.');
        }

        console.log('\n🎉 Comprehensive fix completed!');

    } catch (error) {
        console.error('❌ Error in comprehensive fix:', error);
    }
}

comprehensiveFix();