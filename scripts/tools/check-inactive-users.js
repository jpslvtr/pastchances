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

async function checkInactiveUsers() {
    try {
        const usersSnapshot = await db.collection('users').get();

        // Get all crushes
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

        // Find people being crushed on who haven't signed up
        const inactiveUsers = [];
        GSB_CLASS_NAMES.forEach(className => {
            if (!realUserNames.has(className) && allCrushNames.has(className)) {
                // Count how many people are crushing on them
                let crushCount = 0;
                usersSnapshot.forEach(doc => {
                    const crushes = doc.data().crushes || [];
                    if (crushes.includes(className)) {
                        crushCount++;
                    }
                });

                inactiveUsers.push({
                    name: className,
                    crushCount: crushCount
                });
            }
        });

        console.log(`Real users who signed up: ${realUserNames.size}`);
        console.log(`Inactive users (being crushed on but haven't signed up): ${inactiveUsers.length}`);
        console.log(`Total in admin dashboard: ${realUserNames.size + inactiveUsers.length}`);
        console.log(`Class roster total: ${GSB_CLASS_NAMES.length}`);

        if (inactiveUsers.length > 0) {
            console.log('\nTop 10 inactive users being crushed on:');
            inactiveUsers
                .sort((a, b) => b.crushCount - a.crushCount)
                .slice(0, 10)
                .forEach((user, index) => {
                    console.log(`${index + 1}. ${user.name} - ${user.crushCount} crushes`);
                });
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

checkInactiveUsers();