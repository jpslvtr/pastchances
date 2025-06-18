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

async function analyzeInactiveReceivers() {
    try {
        console.log('='.repeat(80));
        console.log('USERS WITH CRUSHES WHO HAVEN\'T SUBMITTED CRUSHES');
        console.log('='.repeat(80));

        // Get all users
        const usersSnapshot = await db.collection('users').get();

        // Build user map and track crushers
        const allUsers = new Map();
        const crushersMap = new Map(); // Maps target name to array of crushers

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            const userName = userData.verifiedName || userData.displayName || userData.email || '(Unnamed User)';

            allUsers.set(userName, {
                uid: doc.id,
                email: userData.email,
                verifiedName: userData.verifiedName,
                displayName: userData.displayName,
                crushes: userData.crushes || [],
                crushCount: userData.crushCount || 0,
                hasVerifiedName: !!(userData.verifiedName && userData.verifiedName.trim() !== ''),
                hasSubmittedCrushes: !!(userData.crushes && userData.crushes.length > 0)
            });

            // Track who is crushing on whom
            const userCrushes = userData.crushes || [];
            userCrushes.forEach(crushName => {
                if (!crushersMap.has(crushName)) {
                    crushersMap.set(crushName, []);
                }
                crushersMap.get(crushName).push({
                    name: userName,
                    email: userData.email
                });
            });
        });

        // Find users who have received crushes but haven't submitted any
        const inactiveReceivers = [];

        allUsers.forEach((user, userName) => {
            if (user.crushCount > 0) {
                const hasVerifiedName = user.hasVerifiedName;
                const hasSubmittedCrushes = user.hasSubmittedCrushes;

                // Only include if they have no verified name OR no submitted crushes
                if (!hasVerifiedName || !hasSubmittedCrushes) {
                    const crushers = crushersMap.get(userName) || [];

                    let reason = '';
                    if (!hasVerifiedName && !hasSubmittedCrushes) {
                        reason = 'No verified name and no crushes submitted';
                    } else if (!hasVerifiedName) {
                        reason = 'No verified name';
                    } else if (!hasSubmittedCrushes) {
                        reason = 'No crushes submitted';
                    }

                    inactiveReceivers.push({
                        name: userName,
                        email: user.email,
                        crushCount: user.crushCount,
                        reason: reason,
                        crushers: crushers
                    });
                }
            }
        });

        // Sort by crush count (highest first)
        inactiveReceivers.sort((a, b) => b.crushCount - a.crushCount);

        console.log(`Found ${inactiveReceivers.length} users who have received crushes but are inactive:\n`);

        if (inactiveReceivers.length === 0) {
            console.log('🎉 All users who have received crushes are fully active!');
        } else {
            inactiveReceivers.forEach((user, index) => {
                const rank = (index + 1).toString().padStart(2);
                const crushText = user.crushCount === 1 ? 'crush' : 'crushes';

                console.log(`${rank}. ${user.name} - ${user.crushCount} ${crushText}`);
                console.log(`    Email: ${user.email}`);
                console.log(`    Status: ${user.reason}`);
                console.log(`    Being crushed on by:`);

                user.crushers.forEach(crusher => {
                    console.log(`      • ${crusher.name} (${crusher.email})`);
                });

                console.log('');
            });

            // Summary by reason
            const reasonCounts = {};
            inactiveReceivers.forEach(user => {
                reasonCounts[user.reason] = (reasonCounts[user.reason] || 0) + 1;
            });

            console.log('='.repeat(80));
            console.log('SUMMARY BY REASON:');
            Object.entries(reasonCounts).forEach(([reason, count]) => {
                console.log(`  ${reason}: ${count} users`);
            });

            const totalCrushes = inactiveReceivers.reduce((sum, user) => sum + user.crushCount, 0);
            console.log(`\nTotal crushes directed at these inactive users: ${totalCrushes}`);
        }

        console.log('\n' + '='.repeat(80));

    } catch (error) {
        console.error('Error analyzing inactive receivers:', error);
    } finally {
        process.exit(0);
    }
}

analyzeInactiveReceivers();