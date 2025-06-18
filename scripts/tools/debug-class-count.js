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

async function debugClassCount() {
    try {
        console.log(`📋 GSB_CLASS_NAMES has ${GSB_CLASS_NAMES.length} names`);

        // Get all users
        const usersSnapshot = await db.collection('users').get();
        console.log(`👥 Database has ${usersSnapshot.size} users`);

        // Get all verified names from real users
        const realUserNames = new Set();
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.verifiedName) {
                realUserNames.add(userData.verifiedName);
            }
        });

        console.log(`✅ Users with verified names: ${realUserNames.size}`);

        // Check how many class names have corresponding users
        let foundMatches = 0;
        let notFound = [];

        GSB_CLASS_NAMES.forEach(className => {
            if (realUserNames.has(className)) {
                foundMatches++;
            } else {
                notFound.push(className);
            }
        });

        console.log(`🎯 Class names with exact matches: ${foundMatches}`);
        console.log(`👻 Class names without matches: ${notFound.length}`);

        // Expected totals
        const expectedTotal = usersSnapshot.size + notFound.length;
        console.log(`🧮 Expected total (${usersSnapshot.size} real + ${notFound.length} ghosts): ${expectedTotal}`);

        // Show some examples of non-matching names
        if (notFound.length > 0) {
            console.log(`\n📝 First 10 class names without matches:`);
            notFound.slice(0, 10).forEach((name, idx) => {
                console.log(`   ${idx + 1}. "${name}"`);
            });
        }

        // Check if there are duplicates in class list
        const classNameSet = new Set(GSB_CLASS_NAMES);
        if (classNameSet.size !== GSB_CLASS_NAMES.length) {
            console.log(`⚠️ WARNING: Class list has duplicates! ${GSB_CLASS_NAMES.length} names, ${classNameSet.size} unique`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        process.exit(0);
    }
}

debugClassCount();