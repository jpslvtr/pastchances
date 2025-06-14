const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'stanford-lastchances',
});

const db = admin.firestore();

async function findAllJackVariations() {
    try {
        console.log('🔍 Finding all variations of Jack Strauss in crush lists...\n');

        const snapshot = await db.collection('users').get();
        const jackVariations = [];

        snapshot.forEach(doc => {
            const userName = doc.get('verifiedName') || doc.get('displayName') || '(Unnamed User)';
            const crushes = doc.get('crushes') || [];

            crushes.forEach(crush => {
                // Look for any crush that contains "jack" and "strauss"
                const crushLower = crush.toLowerCase();
                if (crushLower.includes('jack') && crushLower.includes('strauss')) {
                    jackVariations.push({
                        crusherName: userName,
                        crushName: crush
                    });
                }
            });
        });

        console.log(`Found ${jackVariations.length} people crushing on Jack variations:`);
        jackVariations.forEach(item => {
            console.log(`   ${item.crusherName} has a crush on "${item.crushName}"`);
        });

        // Also show Jack's current identity
        snapshot.forEach(doc => {
            const userData = doc.data();
            const displayName = userData.displayName;
            const verifiedName = userData.verifiedName;

            if ((displayName && displayName.toLowerCase().includes('jack') && displayName.toLowerCase().includes('strauss')) ||
                (verifiedName && verifiedName.toLowerCase().includes('jack') && verifiedName.toLowerCase().includes('strauss'))) {
                console.log(`\n📋 Jack's current identity:`);
                console.log(`   DisplayName: "${displayName}"`);
                console.log(`   VerifiedName: "${verifiedName}"`);
                console.log(`   CrushCount: ${userData.crushCount || 0}`);
            }
        });

    } catch (error) {
        console.error('❌ Error finding Jack variations:', error);
    }
}

findAllJackVariations();