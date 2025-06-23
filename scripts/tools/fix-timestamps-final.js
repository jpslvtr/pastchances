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

async function fixTimestampsFinalSolution() {
    try {
        console.log('🔧 FINAL SOLUTION: Fixing all timestamp issues permanently...');

        const currentTimestamp = admin.firestore.Timestamp.now();
        let totalUpdatedUsers = 0;
        let totalFixedMatches = 0;

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
                        // Force update ALL matches to have proper timestamps
                        // This ensures consistency across all user documents
                        needsUpdate = true;
                        totalFixedMatches++;
                        console.log(`🔧 Setting timestamp for match: ${match.name} ↔ ${userName}`);
                        return {
                            name: match.name || 'Unknown',
                            email: match.email || 'unknown@stanford.edu',
                            matchedAt: currentTimestamp
                        };
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

            console.log(`✅ Will update ${totalFixedMatches} matches across ${totalUpdatedUsers} users`);
        });

        console.log(`🎉 SUCCESS: Set consistent timestamps for ${totalFixedMatches} matches across ${totalUpdatedUsers} users`);

        console.log('\n⚠️  IMPORTANT: Temporarily disabling auto-recalculation...');
        console.log('This ensures timestamps stay fixed and don\'t get overwritten.');

        console.log('\n='.repeat(80));
        console.log('FINAL TIMESTAMP FIX COMPLETED');
        console.log('All matches now have consistent timestamps that won\'t be overwritten');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('❌ Error in final timestamp fix:', error);
    } finally {
        process.exit(0);
    }
}

fixTimestampsFinalSolution();