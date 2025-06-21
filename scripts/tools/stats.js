import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load service account key
const serviceAccount = JSON.parse(
    readFileSync(join(__dirname, '../../functions/src/serviceAccountKey.json'), 'utf8')
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'stanford-lastchances',
});

const db = admin.firestore();

// Dynamic import to load the TypeScript file
let GSB_CLASS_NAMES;
try {
    const namesContent = readFileSync(join(__dirname, '../../src/data/names.ts'), 'utf8');
    const arrayMatch = namesContent.match(/export\s+const\s+GSB_CLASS_NAMES\s*=\s*(\[[\s\S]*?\]);/);
    if (arrayMatch) {
        GSB_CLASS_NAMES = eval(arrayMatch[1]);
    } else {
        throw new Error('Could not parse GSB_CLASS_NAMES from names.ts');
    }
} catch (error) {
    console.error('Failed to load names from names.ts:', error);
    process.exit(1);
}

async function runAnalytics() {
    try {
        console.log('='.repeat(80));
        console.log('STANFORD LAST CHANCES - ANALYTICS');
        console.log('='.repeat(80));

        // Get total class size from names.ts
        const TOTAL_CLASS_SIZE = GSB_CLASS_NAMES.length;
        console.log(`Class size: ${TOTAL_CLASS_SIZE}`);

        // Get all data
        const usersSnapshot = await db.collection('users').get();

        // 1. Platform stats
        const totalUsers = usersSnapshot.size;

        console.log('\nPLATFORM:');
        console.log(`Total users in database: ${totalUsers}`);

        // 2. Process users data
        const allUsers = [];
        const usersBeingCrushedOn = new Set();
        let totalCrushesSent = 0;
        let usersWithNames = 0;

        usersSnapshot.forEach(doc => {
            const userData = doc.data();

            // Use the new single name field (with fallback for migration)
            const userName = userData.name || userData.verifiedName || userData.displayName || userData.email || '(Unnamed User)';
            const hasName = !!(userData.name && userData.name.trim());

            const userInfo = {
                name: userName,
                hasName: hasName,
                crushes: userData.crushes || [],
                matches: userData.matches || [],
                crushCount: userData.crushCount || 0
            };

            allUsers.push(userInfo);

            // Count users with names set
            if (hasName) {
                usersWithNames++;
            }

            // Count crushes sent and track who's being crushed on
            const userCrushes = userData.crushes || [];
            totalCrushesSent += userCrushes.length;

            userCrushes.forEach(crushName => {
                usersBeingCrushedOn.add(crushName);
            });
        });

        // 3. Calculate crush statistics
        const avgCrushesSentPerUser = usersWithNames > 0 ? totalCrushesSent / usersWithNames : 0;
        const peopleBeingCrushedOn = usersBeingCrushedOn.size;

        console.log(`Users with names set: ${usersWithNames}`);
        console.log(`Users without names: ${totalUsers - usersWithNames}`);

        console.log('\nCRUSHES:');
        console.log(`Total crushes sent: ${totalCrushesSent}`);
        console.log(`Average crushes per user with name: ${avgCrushesSentPerUser.toFixed(2)}`);
        console.log(`People being crushed on: ${peopleBeingCrushedOn}`);

        // 4. Calculate matches
        const seenPairs = new Set();
        allUsers.forEach(user => {
            const matches = user.matches || [];
            if (Array.isArray(matches) && matches.length > 0) {
                matches.forEach(match => {
                    const matchName = match.name || match;
                    const pair = [user.name, matchName].sort().join(' - ');
                    seenPairs.add(pair);
                });
            }
        });

        const totalMatches = seenPairs.size;
        const usersWithMatches = allUsers.filter(user => user.matches.length > 0).length;

        console.log('\nMATCHES:');
        console.log(`Total unique matches: ${totalMatches}`);
        console.log(`Users with matches: ${usersWithMatches}`);

        // 5. Activity statistics
        const usersWithCrushCount = allUsers.filter(user => user.crushCount > 0).length;
        const usersWhoSentCrushes = allUsers.filter(user => user.crushes.length > 0).length;

        console.log('\nACTIVITY:');
        console.log(`Users with others crushing on them: ${usersWithCrushCount}`);
        console.log(`Users who have sent crushes: ${usersWhoSentCrushes}`);

        // 6. Participation rates
        const platformParticipationRate = usersWithNames > 0 ? (usersWhoSentCrushes / usersWithNames * 100) : 0;
        const classParticipationRate = (usersWhoSentCrushes / TOTAL_CLASS_SIZE * 100);

        console.log('\nPARTICIPATION:');
        console.log(`Platform participation rate: ${platformParticipationRate.toFixed(1)}% (${usersWhoSentCrushes}/${usersWithNames} users with names)`);
        console.log(`Class participation rate: ${classParticipationRate.toFixed(1)}% (${usersWhoSentCrushes}/${TOTAL_CLASS_SIZE} total class)`);

        console.log('\n' + '='.repeat(80));

        return {
            classSize: TOTAL_CLASS_SIZE,
            platform: {
                totalUsers,
                usersWithNames,
                usersWithoutNames: totalUsers - usersWithNames
            },
            crushes: {
                totalCrushesSent,
                avgCrushesSentPerUser: Number(avgCrushesSentPerUser.toFixed(2)),
                peopleBeingCrushedOn
            },
            matches: {
                totalMatches,
                usersWithMatches
            },
            activity: {
                usersWithCrushCount,
                usersWhoSentCrushes
            },
            participation: {
                platformParticipationRate: Number(platformParticipationRate.toFixed(1)),
                classParticipationRate: Number(classParticipationRate.toFixed(1))
            }
        };

    } catch (error) {
        console.error('Error running analytics:', error);
    } finally {
        process.exit(0);
    }
}

runAnalytics();