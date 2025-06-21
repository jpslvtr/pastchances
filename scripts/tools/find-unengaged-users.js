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

// Load class names
let GSB_CLASS_NAMES;
try {
    const namesContent = readFileSync(join(__dirname, '../../src/data/names.ts'), 'utf8');
    const arrayMatch = namesContent.match(/export\s+const\s+GSB_CLASS_NAMES\s*=\s*(\[[\s\S]*?\]);/);
    if (arrayMatch) {
        GSB_CLASS_NAMES = eval(arrayMatch[1]);
    }
} catch (error) {
    console.error('Failed to load names:', error);
    process.exit(1);
}

async function findUnengagedUsers() {
    try {
        const usersSnapshot = await db.collection('users').get();

        // Get all crushes and real user names
        const allCrushNames = new Set();
        const realUserNames = new Set();

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            const userName = userData.name;

            if (userName) {
                realUserNames.add(userName);
            }

            const crushes = userData.crushes || [];
            crushes.forEach(crush => allCrushNames.add(crush));
        });

        // Find people with zero engagement
        const unengagedUsers = [];
        const activeUsers = [];
        const inactiveUsers = [];

        GSB_CLASS_NAMES.forEach(className => {
            if (realUserNames.has(className)) {
                activeUsers.push(className);
            } else if (allCrushNames.has(className)) {
                inactiveUsers.push(className);
            } else {
                unengagedUsers.push(className);
            }
        });

        console.log(`=`.repeat(80));
        console.log('COMPLETE CLASS BREAKDOWN');
        console.log(`=`.repeat(80));
        console.log(`Total class roster: ${GSB_CLASS_NAMES.length}`);
        console.log(`Active users (signed up): ${activeUsers.length}`);
        console.log(`Inactive users (being crushed on): ${inactiveUsers.length}`);
        console.log(`Unengaged users (zero activity): ${unengagedUsers.length}`);
        console.log('');

        console.log(`THE ${unengagedUsers.length} COMPLETELY UNENGAGED USERS:`);
        console.log(`=`.repeat(50));

        // Sort alphabetically for easy reading
        unengagedUsers.sort().forEach((name, index) => {
            console.log(`${(index + 1).toString().padStart(2)}. ${name}`);
        });

        console.log('');
        console.log('ANALYSIS:');
        console.log(`• These ${unengagedUsers.length} people have not signed up`);
        console.log(`• Nobody is crushing on any of these ${unengagedUsers.length} people`);
        console.log(`• They represent ${(unengagedUsers.length / GSB_CLASS_NAMES.length * 100).toFixed(1)}% of the class`);
        console.log(`• Focus outreach efforts on the 133 inactive users who ARE being crushed on`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

findUnengagedUsers();