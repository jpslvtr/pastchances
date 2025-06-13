const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'stanford-lastchances',
});

const db = admin.firestore();

function normalizeName(name) {
    if (!name || typeof name !== 'string') return '';
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function debugOrphanedCrushes() {
    try {
        console.log('🔍 Debugging orphaned crushes...\n');

        // Get all users
        const usersSnapshot = await db.collection('users').get();
        const allUsers = [];
        const nameToUser = new Map();

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            const user = {
                id: doc.id,
                uid: userData.uid,
                email: userData.email,
                displayName: userData.displayName,
                verifiedName: userData.verifiedName,
                crushes: userData.crushes || [],
            };
            allUsers.push(user);

            const currentName = user.verifiedName || user.displayName;
            if (currentName && currentName.trim()) {
                nameToUser.set(normalizeName(currentName), user);
            }
        });

        console.log(`Total users: ${allUsers.length}`);
        console.log(`Users with names: ${nameToUser.size}\n`);

        // Check specifically for Shailee and Carolyn
        console.log('🔍 Looking for Shailee Samar...');
        const shaileeNormalized = normalizeName('Shailee Samar');
        const shaileeUser = nameToUser.get(shaileeNormalized);
        if (shaileeUser) {
            console.log(`✅ Found Shailee: ${shaileeUser.email}`);
            console.log(`   verifiedName: "${shaileeUser.verifiedName}"`);
            console.log(`   displayName: "${shaileeUser.displayName}"`);
        } else {
            console.log('❌ Shailee Samar not found in current users');
        }

        console.log('\n🔍 Looking for Carolyn Bruckmann...');
        const carolynNormalized = normalizeName('Carolyn Bruckmann');
        const carolynUser = nameToUser.get(carolynNormalized);
        if (carolynUser) {
            console.log(`❌ Found Carolyn as current user: ${carolynUser.email}`);
        } else {
            console.log('✅ Carolyn Bruckmann not found in current users (good - it\'s orphaned)');
        }

        // Find all crush instances
        console.log('\n📋 All crush instances:');
        for (const user of allUsers) {
            const userCrushes = user.crushes || [];
            for (const crushName of userCrushes) {
                if (crushName.toLowerCase().includes('carolyn') || crushName.toLowerCase().includes('shailee')) {
                    const userName = user.verifiedName || user.displayName || user.email;
                    console.log(`   ${userName} has crush on "${crushName}"`);
                }
            }
        }

        // Test the mapping
        console.log('\n🧪 Testing known mapping...');
        const knownMappings = {
            'Carolyn Bruckmann': 'Shailee Samar',
        };

        const orphanedName = 'Carolyn Bruckmann';
        const targetName = knownMappings[orphanedName];

        console.log(`Orphaned: "${orphanedName}"`);
        console.log(`Target: "${targetName}"`);
        console.log(`Target normalized: "${normalizeName(targetName)}"`);
        console.log(`Target user exists: ${nameToUser.has(normalizeName(targetName))}`);

        if (nameToUser.has(normalizeName(targetName))) {
            const targetUser = nameToUser.get(normalizeName(targetName));
            console.log(`Target user: ${targetUser.email} (verified: "${targetUser.verifiedName}", display: "${targetUser.displayName}")`);
        }

    } catch (error) {
        console.error('❌ Error in debugOrphanedCrushes:', error);
    }
}

debugOrphanedCrushes();