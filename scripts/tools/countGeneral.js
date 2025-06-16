import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load service account key - corrected path
const serviceAccount = JSON.parse(
    readFileSync(join(__dirname, '../../functions/src/serviceAccountKey.json'), 'utf8')
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'stanford-lastchances',
});

const db = admin.firestore();

async function runAnalytics() {
    try {
        console.log('='.repeat(60));

        // Get all data
        const usersSnapshot = await db.collection('users').get();
        const takenNamesSnapshot = await db.collection('takenNames').get();

        // 1. Basic stats
        const totalUsers = usersSnapshot.size;
        const totalTakenNames = takenNamesSnapshot.size;

        console.log('\nUSER & NAME STATS:');
        console.log(`Total users: ${totalUsers}`);
        console.log(`Total taken names: ${totalTakenNames}`);

        // 2. Process users data
        const allUsers = [];
        const seenPairs = new Set();

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            const userName = userData.verifiedName || userData.displayName || userData.email || '(Unnamed User)';

            const userInfo = {
                name: userName,
                crushCount: userData.crushCount || 0,
                matches: userData.matches || [],
                crushes: userData.crushes || []
            };

            allUsers.push(userInfo);

            // Count unique matches
            const matches = userData.matches || [];
            if (Array.isArray(matches) && matches.length > 0) {
                matches.forEach(match => {
                    const matchName = match.name || match;
                    const pair = [userName, matchName].sort().join(' - ');
                    seenPairs.add(pair);
                });
            }
        });

        // 3. Calculate statistics
        const totalMatches = seenPairs.size;
        const matchedPairs = Array.from(seenPairs).sort();

        const totalCrushes = allUsers.reduce((sum, user) => sum + user.crushCount, 0);
        const peopleWithCrushes = allUsers.filter(user => user.crushCount > 0).length;
        const avgCrushes = totalUsers > 0 ? totalCrushes / totalUsers : 0;

        // 4. User activity stats
        const usersWithCrushes = allUsers.filter(user => user.crushes.length > 0).length;
        const usersWithMatches = allUsers.filter(user => user.matches.length > 0).length;

        // 5. Matches analysis
        console.log('\nMATCHES:');
        console.log(`Total unique matches: ${totalMatches}`);
        if (totalMatches > 0) {
            console.log('\nMatched pairs:');
            matchedPairs.forEach(pair => {
                console.log(`- ${pair}`);
            });
        } else {
            console.log('No matches yet!');
        }

        // 6. Crush statistics
        console.log('\nCRUSH STATISTICS:');
        console.log(`Total people being crushed on: ${peopleWithCrushes}`);
        console.log(`Total crushes across all users: ${totalCrushes}`);
        console.log(`Average crushes per person: ${avgCrushes.toFixed(2)}`);

        // 7. User activity stats
        console.log('\nUSER ACTIVITY:');
        console.log(`Users with crushes: ${usersWithCrushes}`);
        console.log(`Users with matches: ${usersWithMatches}`);
        console.log(`Participation rate: ${(usersWithCrushes / totalUsers * 100).toFixed(2)}%`);

        console.log('\n' + '='.repeat(60));

        // Return the same data structure as the cloud function
        return {
            totalUsers,
            totalTakenNames,
            totalMatches,
            matchedPairs,
            totalCrushes,
            peopleWithCrushes,
            avgCrushes: Number(avgCrushes.toFixed(2)),
            usersWithCrushes,
            usersWithMatches,
            participationRate: Number((usersWithCrushes / totalUsers * 100).toFixed(2))
        };

    } catch (error) {
        console.error('Error running analytics:', error);
    } finally {
        process.exit(0);
    }
}

runAnalytics();