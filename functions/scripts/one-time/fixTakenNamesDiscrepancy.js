const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'stanford-lastchances',
});

const db = admin.firestore();

async function fixTakenNamesDiscrepancy() {
    try {
        console.log('🔧 Fixing taken names discrepancy...\n');

        // Get all users
        const usersSnapshot = await db.collection('users').get();
        const takenNamesSnapshot = await db.collection('takenNames').get();

        // Create a set of existing taken names
        const existingTakenNames = new Set();
        takenNamesSnapshot.forEach(doc => {
            existingTakenNames.add(doc.id);
        });

        console.log(`Found ${existingTakenNames.size} existing taken names`);

        // Track what we need to fix
        const missingTakenNames = [];
        const validUsers = [];

        // Check each user
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            const verifiedName = userData.verifiedName;

            if (verifiedName && verifiedName.trim() !== '') {
                if (!existingTakenNames.has(verifiedName)) {
                    missingTakenNames.push({
                        uid: doc.id,
                        email: userData.email,
                        verifiedName: verifiedName
                    });
                } else {
                    validUsers.push({
                        uid: doc.id,
                        email: userData.email,
                        verifiedName: verifiedName
                    });
                }
            }
        });

        console.log(`Users with valid taken names: ${validUsers.length}`);
        console.log(`Users missing taken names: ${missingTakenNames.length}\n`);

        if (missingTakenNames.length === 0) {
            console.log('✅ No missing taken names found. Everything is in sync!');
            return;
        }

        console.log('📝 Missing taken names to create:');
        missingTakenNames.forEach(user => {
            console.log(`   - "${user.verifiedName}" for ${user.email}`);
        });

        console.log('\n🔨 Creating missing taken name documents...');

        // Create missing taken name documents
        const batch = db.batch();

        missingTakenNames.forEach(user => {
            const takenNameRef = db.collection('takenNames').doc(user.verifiedName);
            batch.set(takenNameRef, {
                takenBy: user.uid,
                takenAt: admin.firestore.FieldValue.serverTimestamp(),
                email: user.email
            });
        });

        await batch.commit();

        console.log(`✅ Successfully created ${missingTakenNames.length} taken name document(s)`);

        // Verify the fix
        const newTakenNamesSnapshot = await db.collection('takenNames').get();
        console.log(`\n📊 Final counts:`);
        console.log(`   Users: ${usersSnapshot.size}`);
        console.log(`   Taken names: ${newTakenNamesSnapshot.size}`);
        console.log(`   Discrepancy: ${usersSnapshot.size - newTakenNamesSnapshot.size}`);

        if (usersSnapshot.size === newTakenNamesSnapshot.size) {
            console.log('\n🎉 Discrepancy resolved! All users now have corresponding taken names.');
        } else {
            console.log('\n⚠️  There may still be some discrepancy. Please run the analysis script again.');
        }

    } catch (error) {
        console.error('❌ Error fixing taken names discrepancy:', error);
    }
}

fixTakenNamesDiscrepancy();