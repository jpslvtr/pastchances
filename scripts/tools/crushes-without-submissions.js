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

// Helper function to normalize names for case-insensitive comparison
function normalizeName(name) {
    if (!name || typeof name !== 'string') return '';
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Function to find the best matching user for a crush name
function findUserByName(crushName, allUsers) {
    if (!crushName || !crushName.trim()) return null;

    const normalizedCrush = normalizeName(crushName);

    // First try exact match on verifiedName
    let match = allUsers.find(user =>
        user.verifiedName &&
        normalizeName(user.verifiedName) === normalizedCrush
    );

    if (match) return match;

    // Try exact match on displayName as fallback
    match = allUsers.find(user =>
        user.displayName &&
        normalizeName(user.displayName) === normalizedCrush
    );

    if (match) return match;

    // Try partial match (first and last name only) for cases with middle names
    const crushParts = normalizedCrush.split(' ');
    if (crushParts.length >= 2) {
        const crushFirstLast = `${crushParts[0]} ${crushParts[crushParts.length - 1]}`;

        match = allUsers.find(user => {
            if (user.verifiedName) {
                const nameParts = normalizeName(user.verifiedName).split(' ');
                if (nameParts.length >= 2) {
                    const nameFirstLast = `${nameParts[0]} ${nameParts[nameParts.length - 1]}`;
                    return nameFirstLast === crushFirstLast;
                }
            }
            return false;
        });

        if (match) return match;

        // Try same with displayName
        match = allUsers.find(user => {
            if (user.displayName) {
                const nameParts = normalizeName(user.displayName).split(' ');
                if (nameParts.length >= 2) {
                    const nameFirstLast = `${nameParts[0]} ${nameParts[nameParts.length - 1]}`;
                    return nameFirstLast === crushFirstLast;
                }
            }
            return false;
        });
    }

    return match || null;
}

async function analyzeCrushesWithoutSubmissions() {
    try {
        console.log('🔍 Analyzing people being crushed on vs. people who have submitted crushes...\n');

        // Get all users
        const usersSnapshot = await db.collection('users').get();
        const allUsers = [];

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            allUsers.push({
                id: doc.id,
                uid: userData.uid,
                email: userData.email,
                displayName: userData.displayName,
                verifiedName: userData.verifiedName,
                crushes: userData.crushes || [],
                lockedCrushes: userData.lockedCrushes || [],
                matches: userData.matches || [],
                crushCount: userData.crushCount || 0
            });
        });

        console.log(`📊 Total users: ${allUsers.length}\n`);

        // Find all people being crushed on
        const peopleBeingCrushedOn = new Map(); // name -> { user, crushers }

        for (const user of allUsers) {
            const userCrushes = user.crushes || [];
            const userIdentityName = user.verifiedName || user.displayName;

            if (!userIdentityName || !userIdentityName.trim()) {
                continue;
            }

            for (const crushName of userCrushes) {
                const crushedUser = findUserByName(crushName, allUsers);

                if (crushedUser) {
                    const crushedUserIdentityName = crushedUser.verifiedName || crushedUser.displayName;

                    if (!peopleBeingCrushedOn.has(crushedUserIdentityName)) {
                        peopleBeingCrushedOn.set(crushedUserIdentityName, {
                            user: crushedUser,
                            crushers: []
                        });
                    }

                    peopleBeingCrushedOn.get(crushedUserIdentityName).crushers.push({
                        name: userIdentityName,
                        email: user.email
                    });
                }
            }
        }

        console.log(`💕 Total people being crushed on: ${peopleBeingCrushedOn.size}\n`);

        // Analyze who hasn't submitted any crushes
        const peopleWithoutSubmissions = [];
        const peopleWithSubmissions = [];

        for (const [crushedPersonName, data] of peopleBeingCrushedOn) {
            const { user, crushers } = data;
            const userCrushes = user.crushes || [];

            if (userCrushes.length === 0) {
                peopleWithoutSubmissions.push({
                    name: crushedPersonName,
                    email: user.email,
                    crushCount: crushers.length,
                    crushers: crushers
                });
            } else {
                peopleWithSubmissions.push({
                    name: crushedPersonName,
                    email: user.email,
                    crushCount: crushers.length,
                    submittedCrushes: userCrushes.length,
                    crushers: crushers
                });
            }
        }

        // Sort by crush count (most crushed on first)
        peopleWithoutSubmissions.sort((a, b) => b.crushCount - a.crushCount);
        peopleWithSubmissions.sort((a, b) => b.crushCount - a.crushCount);

        console.log('=' + '='.repeat(80));
        console.log('📋 PEOPLE BEING CRUSHED ON WHO HAVEN\'T SUBMITTED ANY CRUSHES');
        console.log('=' + '='.repeat(80));

        if (peopleWithoutSubmissions.length === 0) {
            console.log('🎉 Everyone being crushed on has submitted at least one crush!');
        } else {
            console.log(`❌ ${peopleWithoutSubmissions.length} people being crushed on haven't submitted any crushes:\n`);

            peopleWithoutSubmissions.forEach((person, index) => {
                console.log(`${(index + 1).toString().padStart(2)}. ${person.name} (${person.email})`);
                console.log(`    Being crushed on by ${person.crushCount} ${person.crushCount === 1 ? 'person' : 'people'}:`);
                person.crushers.forEach(crusher => {
                    console.log(`    - ${crusher.name} (${crusher.email})`);
                });
                console.log('');
            });
        }

        console.log('\n' + '=' + '='.repeat(80));
        console.log('✅ PEOPLE BEING CRUSHED ON WHO HAVE SUBMITTED CRUSHES');
        console.log('=' + '='.repeat(80));

        if (peopleWithSubmissions.length === 0) {
            console.log('😔 No one being crushed on has submitted any crushes yet.');
        } else {
            console.log(`✅ ${peopleWithSubmissions.length} people being crushed on have submitted crushes:\n`);

            peopleWithSubmissions.forEach((person, index) => {
                console.log(`${(index + 1).toString().padStart(2)}. ${person.name} (${person.email})`);
                console.log(`    Being crushed on by ${person.crushCount} ${person.crushCount === 1 ? 'person' : 'people'}, submitted ${person.submittedCrushes} ${person.submittedCrushes === 1 ? 'crush' : 'crushes'}`);
                console.log(`    Crushers:`);
                person.crushers.forEach(crusher => {
                    console.log(`    - ${crusher.name} (${crusher.email})`);
                });
                console.log('');
            });
        }

        // Summary statistics
        console.log('\n' + '=' + '='.repeat(80));
        console.log('📊 SUMMARY STATISTICS');
        console.log('=' + '='.repeat(80));

        const totalBeingCrushedOn = peopleBeingCrushedOn.size;
        const withoutSubmissions = peopleWithoutSubmissions.length;
        const withSubmissions = peopleWithSubmissions.length;
        const percentageWithoutSubmissions = totalBeingCrushedOn > 0 ? ((withoutSubmissions / totalBeingCrushedOn) * 100).toFixed(1) : 0;

        console.log(`Total people being crushed on: ${totalBeingCrushedOn}`);
        console.log(`People without submissions: ${withoutSubmissions} (${percentageWithoutSubmissions}%)`);
        console.log(`People with submissions: ${withSubmissions} (${(100 - percentageWithoutSubmissions).toFixed(1)}%)`);

        // Calculate total missed opportunities
        const totalMissedCrushes = peopleWithoutSubmissions.reduce((sum, person) => sum + person.crushCount, 0);
        console.log(`\n💔 Total "missed opportunities": ${totalMissedCrushes} crushes on people who haven't submitted anything`);

        if (peopleWithoutSubmissions.length > 0) {
            console.log('\n🎯 RECOMMENDATION: Consider reaching out to encourage these people to participate!');
        }

        console.log('\n' + '=' + '='.repeat(80));

    } catch (error) {
        console.error('❌ Error analyzing crushes without submissions:', error);
    } finally {
        process.exit(0);
    }
}

analyzeCrushesWithoutSubmissions();