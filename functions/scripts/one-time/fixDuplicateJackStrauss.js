const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'stanford-lastchances',
});

const db = admin.firestore();

async function fixDuplicateJackStrauss() {
    try {
        console.log('🔧 Fixing duplicate Jack Strauss verifiedNames...\n');

        const snapshot = await db.collection('users').get();
        const jackUsers = [];

        // Find all users with Jack Strauss as verifiedName
        snapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.verifiedName === 'Jack Strauss') {
                jackUsers.push({
                    id: doc.id,
                    email: userData.email,
                    displayName: userData.displayName,
                    verifiedName: userData.verifiedName,
                    crushCount: userData.crushCount || 0
                });
            }
        });

        console.log(`Found ${jackUsers.length} users with verifiedName "Jack Strauss":`);
        jackUsers.forEach((user, index) => {
            console.log(`${index + 1}. ${user.displayName} (${user.email})`);
        });

        if (jackUsers.length !== 2) {
            console.log('❌ Expected exactly 2 users, found', jackUsers.length);
            return;
        }

        // Determine which one should keep "Jack Strauss"
        // Logic: Jack Harrison Strauss should keep it since his displayName is closer
        let realJack = null;
        let otherJack = null;

        if (jackUsers[0].displayName === 'Jack Harrison Strauss') {
            realJack = jackUsers[0];
            otherJack = jackUsers[1];
        } else if (jackUsers[1].displayName === 'Jack Harrison Strauss') {
            realJack = jackUsers[1];
            otherJack = jackUsers[0];
        } else {
            console.log('❌ Could not identify which Jack should keep the name');
            console.log('Manual intervention required');
            return;
        }

        console.log(`\n📋 Plan:`);
        console.log(`✅ ${realJack.displayName} (${realJack.email}) keeps "Jack Strauss"`);
        console.log(`🔄 ${otherJack.displayName} (${otherJack.email}) gets verifiedName cleared`);

        // Ask for confirmation (in a script, we'll just proceed)
        console.log('\n🔨 Executing fix...');

        // Clear the other Jack's verifiedName
        const otherJackRef = db.collection('users').doc(otherJack.id);
        await otherJackRef.update({
            verifiedName: '', // Clear it so they have to re-verify with correct name
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ Cleared verifiedName for ${otherJack.displayName}`);

        // Remove the duplicate from takenNames
        const takenNameRef = db.collection('takenNames').doc('Jack Strauss');
        await takenNameRef.update({
            takenBy: realJack.id, // Ensure it points to the correct Jack
            email: realJack.email
        });

        console.log(`✅ Updated takenNames to point to correct Jack`);

        // Force a recalculation
        const tempRef = db.collection('users').doc(realJack.id);
        await tempRef.update({
            forceRecalc: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ Triggered recalculation`);
        console.log('\n🎉 Fix completed!');
        console.log(`\nNext steps:`);
        console.log(`1. ${otherJack.displayName} will need to log in and select their correct name`);
        console.log(`2. ${realJack.displayName} should now have the correct crush count`);

    } catch (error) {
        console.error('❌ Error fixing duplicate Jack Strauss:', error);
    }
}

fixDuplicateJackStrauss();