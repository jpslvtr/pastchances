const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'stanford-lastchances',
});

const db = admin.firestore();

async function findMissingTakenNames() {
    try {
        console.log('🔍 Analyzing discrepancy between users and taken names...\n');

        // Get all users
        const usersSnapshot = await db.collection('users').get();
        const takenNamesSnapshot = await db.collection('takenNames').get();

        console.log(`Total users: ${usersSnapshot.size}`);
        console.log(`Total taken names: ${takenNamesSnapshot.size}`);
        console.log(`Discrepancy: ${usersSnapshot.size - takenNamesSnapshot.size} users\n`);

        // Get all taken names
        const takenNamesSet = new Set();
        takenNamesSnapshot.forEach(doc => {
            takenNamesSet.add(doc.id);
        });

        console.log('📋 Analyzing each user...\n');

        const usersWithoutTakenNames = [];
        const usersWithEmptyNames = [];
        const usersWithValidNames = [];

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            const verifiedName = userData.verifiedName;
            const email = userData.email || '(No email)';

            if (!verifiedName) {
                usersWithoutTakenNames.push({
                    uid: doc.id,
                    email: email,
                    verifiedName: null,
                    displayName: userData.displayName || '(No display name)'
                });
            } else if (verifiedName.trim() === '') {
                usersWithEmptyNames.push({
                    uid: doc.id,
                    email: email,
                    verifiedName: verifiedName,
                    displayName: userData.displayName || '(No display name)'
                });
            } else {
                usersWithValidNames.push({
                    uid: doc.id,
                    email: email,
                    verifiedName: verifiedName,
                    hasTakenName: takenNamesSet.has(verifiedName)
                });
            }
        });

        // Report findings
        console.log('❌ Users without verifiedName field:');
        if (usersWithoutTakenNames.length === 0) {
            console.log('   None found');
        } else {
            usersWithoutTakenNames.forEach(user => {
                console.log(`   - ${user.email} (Display: ${user.displayName})`);
            });
        }

        console.log('\n❌ Users with empty verifiedName:');
        if (usersWithEmptyNames.length === 0) {
            console.log('   None found');
        } else {
            usersWithEmptyNames.forEach(user => {
                console.log(`   - ${user.email} (Display: ${user.displayName})`);
            });
        }

        console.log('\n⚠️  Users with verifiedName but no corresponding takenName document:');
        const usersWithMissingTakenNames = usersWithValidNames.filter(user => !user.hasTakenName);
        if (usersWithMissingTakenNames.length === 0) {
            console.log('   None found');
        } else {
            usersWithMissingTakenNames.forEach(user => {
                console.log(`   - ${user.email} (Verified: ${user.verifiedName})`);
            });
        }

        console.log('\n✅ Users with properly set verifiedName and takenName:');
        const usersWithProperTakenNames = usersWithValidNames.filter(user => user.hasTakenName);
        console.log(`   ${usersWithProperTakenNames.length} users have proper setup`);

        // Summary
        console.log('\n📊 SUMMARY:');
        console.log(`   Users without verifiedName: ${usersWithoutTakenNames.length}`);
        console.log(`   Users with empty verifiedName: ${usersWithEmptyNames.length}`);
        console.log(`   Users with missing takenName docs: ${usersWithMissingTakenNames.length}`);
        console.log(`   Users properly configured: ${usersWithProperTakenNames.length}`);
        console.log(`   Total discrepancy explained: ${usersWithoutTakenNames.length + usersWithEmptyNames.length + usersWithMissingTakenNames.length}`);

        // Check for orphaned takenNames (takenNames without corresponding users)
        console.log('\n🔍 Checking for orphaned takenName documents...');
        const allUserUids = new Set();
        usersSnapshot.forEach(doc => {
            allUserUids.add(doc.id);
        });

        const orphanedTakenNames = [];
        takenNamesSnapshot.forEach(doc => {
            const takenNameData = doc.data();
            const takenBy = takenNameData.takenBy;
            if (!allUserUids.has(takenBy)) {
                orphanedTakenNames.push({
                    name: doc.id,
                    takenBy: takenBy,
                    email: takenNameData.email || '(No email)'
                });
            }
        });

        if (orphanedTakenNames.length === 0) {
            console.log('   No orphaned takenName documents found');
        } else {
            console.log(`   Found ${orphanedTakenNames.length} orphaned takenName documents:`);
            orphanedTakenNames.forEach(item => {
                console.log(`   - ${item.name} (claimed by non-existent user: ${item.takenBy})`);
            });
        }

    } catch (error) {
        console.error('❌ Error analyzing discrepancy:', error);
    }
}

findMissingTakenNames();