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

async function displayAllMatches() {
    try {
        console.log('='.repeat(80));
        console.log('STANFORD LAST CHANCES - ALL MATCHES');
        console.log('='.repeat(80));

        // Get all users
        const usersSnapshot = await db.collection('users').get();
        const allMatches = new Map(); // Use Map to avoid duplicates
        const userMap = new Map(); // Map to store user data by UID

        // Build user map for quick lookups
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.verifiedName) {
                userMap.set(doc.id, {
                    uid: doc.id,
                    verifiedName: userData.verifiedName,
                    email: userData.email,
                    matches: userData.matches || []
                });
            }
        });

        // Collect all unique matches
        userMap.forEach((user) => {
            if (user.matches && user.matches.length > 0) {
                user.matches.forEach(match => {
                    // Create a unique pair key (alphabetical order to avoid duplicates)
                    const pairKey = [user.verifiedName, match.name].sort().join(' ↔ ');

                    if (!allMatches.has(pairKey)) {
                        allMatches.set(pairKey, {
                            person1: user.verifiedName,
                            person2: match.name,
                            pairKey: pairKey
                        });
                    }
                });
            }
        });

        // Convert to array and sort alphabetically by the first person's name
        const matchesArray = Array.from(allMatches.values());
        matchesArray.sort((a, b) => {
            const firstPersonA = a.pairKey.split(' ↔ ')[0];
            const firstPersonB = b.pairKey.split(' ↔ ')[0];
            return firstPersonA.localeCompare(firstPersonB);
        });

        console.log(`\nTotal Matches Found: ${matchesArray.length}\n`);

        if (matchesArray.length === 0) {
            console.log('No matches found yet. Keep checking back! 💕');
        } else {
            console.log('MATCH PAIRS:');
            console.log('-'.repeat(80));

            matchesArray.forEach((match, index) => {
                const rank = (index + 1).toString().padStart(2);
                console.log(`${rank}. ${match.pairKey}`);
            });

            // Summary statistics
            console.log('\n' + '='.repeat(80));
            console.log('SUMMARY:');
            console.log(`Total unique matches: ${matchesArray.length}`);
            console.log(`Total people involved in matches: ${matchesArray.length * 2}`);

            // Count unique individuals
            const uniquePeople = new Set();
            matchesArray.forEach(match => {
                uniquePeople.add(match.person1);
                uniquePeople.add(match.person2);
            });
            console.log(`Unique individuals with matches: ${uniquePeople.size}`);

            console.log('='.repeat(80));
        }

    } catch (error) {
        console.error('Error displaying matches:', error);
    } finally {
        process.exit(0);
    }
}

displayAllMatches();