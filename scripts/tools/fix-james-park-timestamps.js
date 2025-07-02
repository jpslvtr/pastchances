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

// Helper function to determine if a match should have a timestamp
function shouldMatchHaveTimestamp(user1Id, user2Id, user1Name, user2Name) {
    // Check if either user is James Park (by document ID containing jpark22@stanford.edu OR by name)
    const isUser1JamesPark = user1Id.includes('jpark22@stanford.edu') ||
        user1Name === 'James Park' ||
        (user1Id.includes('_gsb') && user1Id.includes('jpark22@stanford.edu')) ||
        (user1Id.includes('_undergrad') && user1Id.includes('jpark22@stanford.edu'));

    const isUser2JamesPark = user2Id.includes('jpark22@stanford.edu') ||
        user2Name === 'James Park' ||
        (user2Id.includes('_gsb') && user2Id.includes('jpark22@stanford.edu')) ||
        (user2Id.includes('_undergrad') && user2Id.includes('jpark22@stanford.edu'));

    // Skip timestamp for ANY James Park matches (GSB or undergrad)
    if (isUser1JamesPark || isUser2JamesPark) {
        console.log(`🚫 Skipping timestamp for James Park match: ${user1Name} ↔ ${user2Name}`);
        return false;
    }

    // All other matches should have timestamps
    return true;
}

async function fixJamesParkTimestamps() {
    try {
        console.log('🔧 FIXING JAMES PARK TIMESTAMP LOGIC...');

        const currentTimestamp = admin.firestore.Timestamp.now();
        let totalUpdatedUsers = 0;
        let totalFixedMatches = 0;
        let jamesParkMatchesFixed = 0;

        await db.runTransaction(async (transaction) => {
            // Get all users
            const usersSnapshot = await transaction.get(db.collection('users'));

            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                const matches = userData.matches || [];
                const userId = doc.id;
                const userName = userData.name || userData.verifiedName || userData.displayName || userData.email;

                if (matches.length > 0) {
                    let needsUpdate = false;
                    const updatedMatches = matches.map(match => {
                        const shouldHaveTimestamp = shouldMatchHaveTimestamp(userId, '', userName, match.name || '');

                        if (shouldHaveTimestamp) {
                            // Non-James Park match should have timestamp
                            if (!match.matchedAt) {
                                needsUpdate = true;
                                totalFixedMatches++;
                                console.log(`🔧 Adding timestamp to match: ${match.name} ↔ ${userName}`);
                                return {
                                    name: match.name || 'Unknown',
                                    email: match.email || 'unknown@stanford.edu',
                                    matchedAt: currentTimestamp
                                };
                            } else {
                                // Already has timestamp, keep it
                                return match;
                            }
                        } else {
                            // James Park match should NOT have timestamp
                            if (match.matchedAt) {
                                needsUpdate = true;
                                jamesParkMatchesFixed++;
                                console.log(`🔧 Removing timestamp from James Park match: ${match.name} ↔ ${userName}`);
                            }
                            return {
                                name: match.name || 'Unknown',
                                email: match.email || 'unknown@stanford.edu'
                                // No matchedAt field
                            };
                        }
                    });

                    if (needsUpdate) {
                        const userRef = db.collection('users').doc(userId);
                        transaction.update(userRef, {
                            matches: updatedMatches,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                        totalUpdatedUsers++;
                    }
                }
            });

            console.log(`✅ Will update ${totalUpdatedUsers} users`);
            console.log(`✅ Will fix ${totalFixedMatches} regular matches (add timestamps)`);
            console.log(`✅ Will fix ${jamesParkMatchesFixed} James Park matches (remove timestamps)`);
        });

        console.log(`🎉 SUCCESS: Fixed James Park timestamp logic`);
        console.log(`📊 Updated ${totalUpdatedUsers} users`);
        console.log(`📊 Fixed ${totalFixedMatches} regular matches`);
        console.log(`📊 Fixed ${jamesParkMatchesFixed} James Park matches`);

    } catch (error) {
        console.error('❌ Error fixing James Park timestamps:', error);
    } finally {
        process.exit(0);
    }
}

fixJamesParkTimestamps();