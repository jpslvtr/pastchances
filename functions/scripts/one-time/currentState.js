const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'stanford-lastchances',
});

const db = admin.firestore();

async function currentState() {
    try {
        console.log('🔍 Checking current state of Shailee and Emily...\n');

        const usersSnapshot = await db.collection('users').get();
        let shaileeUser = null;
        let emilyUser = null;

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            const userName = userData.verifiedName || userData.displayName;

            if (userName === 'Shailee Samar') {
                shaileeUser = {
                    id: doc.id,
                    email: userData.email,
                    verifiedName: userData.verifiedName,
                    displayName: userData.displayName,
                    crushes: userData.crushes || [],
                    lockedCrushes: userData.lockedCrushes || [],
                    matches: userData.matches || [],
                    crushCount: userData.crushCount || 0
                };
            }

            if (userName === 'Emily Tench') {
                emilyUser = {
                    id: doc.id,
                    email: userData.email,
                    verifiedName: userData.verifiedName,
                    displayName: userData.displayName,
                    crushes: userData.crushes || [],
                    lockedCrushes: userData.lockedCrushes || [],
                    matches: userData.matches || [],
                    crushCount: userData.crushCount || 0
                };
            }
        });

        console.log('👤 Shailee Samar:');
        if (shaileeUser) {
            console.log(`   Email: ${shaileeUser.email}`);
            console.log(`   VerifiedName: "${shaileeUser.verifiedName}"`);
            console.log(`   DisplayName: "${shaileeUser.displayName}"`);
            console.log(`   Crushes: [${shaileeUser.crushes.map(c => `"${c}"`).join(', ')}]`);
            console.log(`   LockedCrushes: [${shaileeUser.lockedCrushes.map(c => `"${c}"`).join(', ')}]`);
            console.log(`   Matches: ${shaileeUser.matches.length}`);
            console.log(`   CrushCount: ${shaileeUser.crushCount}`);
        } else {
            console.log('   NOT FOUND');
        }

        console.log('\n👤 Emily Tench:');
        if (emilyUser) {
            console.log(`   Email: ${emilyUser.email}`);
            console.log(`   VerifiedName: "${emilyUser.verifiedName}"`);
            console.log(`   DisplayName: "${emilyUser.displayName}"`);
            console.log(`   Crushes: [${emilyUser.crushes.map(c => `"${c}"`).join(', ')}]`);
            console.log(`   LockedCrushes: [${emilyUser.lockedCrushes.map(c => `"${c}"`).join(', ')}]`);
            console.log(`   Matches: ${emilyUser.matches.length}`);
            console.log(`   CrushCount: ${emilyUser.crushCount}`);
        } else {
            console.log('   NOT FOUND');
        }

        // Now run the same logic as findUserInCrushes to see what's happening
        console.log('\n🔍 Running findUserInCrushes logic...');

        const targetNames = ["Shailee Samar", "Carolyn Bruckmann"];
        let foundAny = false;

        usersSnapshot.forEach(doc => {
            const userName = doc.get('verifiedName') || doc.get('displayName') || '(Unnamed User)';
            const crushes = doc.get('crushes') || [];

            crushes.forEach(crush => {
                if (targetNames.includes(crush)) {
                    console.log(`   ${userName} has a crush on "${crush}"`);
                    foundAny = true;
                }
            });
        });

        if (!foundAny) {
            console.log('   No crushes found for target names');
        }

    } catch (error) {
        console.error('❌ Error in currentState:', error);
    }
}

currentState();