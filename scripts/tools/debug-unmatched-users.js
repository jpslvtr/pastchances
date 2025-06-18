import admin from 'firebase-admin';
import { readFileSync } from 'fs';
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

// Load GSB_CLASS_NAMES
let GSB_CLASS_NAMES;
try {
    const namesModule = await import('../../src/data/names.ts');
    GSB_CLASS_NAMES = namesModule.GSB_CLASS_NAMES;
} catch (error) {
    const namesContent = readFileSync(join(__dirname, '../../src/data/names.ts'), 'utf8');
    const arrayMatch = namesContent.match(/export\s+const\s+GSB_CLASS_NAMES\s*=\s*(\[[\s\S]*?\]);/);
    if (arrayMatch) {
        GSB_CLASS_NAMES = eval(arrayMatch[1]);
    }
}

async function debugUnmatchedUsers() {
    try {
        console.log('🔍 Finding users who signed up but aren\'t in class list...\n');

        // Get all users
        const usersSnapshot = await db.collection('users').get();
        const classNameSet = new Set(GSB_CLASS_NAMES);

        const unmatchedUsers = [];

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.verifiedName && !classNameSet.has(userData.verifiedName)) {
                unmatchedUsers.push({
                    email: userData.email,
                    verifiedName: userData.verifiedName,
                    displayName: userData.displayName
                });
            }
        });

        console.log(`Found ${unmatchedUsers.length} users with verified names not in class list:\n`);

        unmatchedUsers.forEach((user, idx) => {
            console.log(`${idx + 1}. "${user.verifiedName}" (${user.email})`);
            if (user.displayName !== user.verifiedName) {
                console.log(`   Display name: "${user.displayName}"`);
            }
        });

        if (unmatchedUsers.length > 0) {
            console.log(`\n💡 These ${unmatchedUsers.length} users are counted as "real users" but don't have ghost counterparts`);
            console.log(`   because their verified names don't exactly match any name in GSB_CLASS_NAMES.`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        process.exit(0);
    }
}

debugUnmatchedUsers();