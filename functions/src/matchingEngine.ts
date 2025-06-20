import * as admin from 'firebase-admin';
import { UserWithId, MatchInfo } from './types';
import { findUserByName } from './utils';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// Enhanced function to recalculate all matches and crush counts with better name matching
export async function processUpdatedCrushes(): Promise<void> {
    console.log('🔄 Starting enhanced recalculation of all matches and crush counts...');

    try {
        await db.runTransaction(async (transaction) => {
            // Get all users
            const allUsersSnapshot = await transaction.get(db.collection('users'));

            const allUsers: UserWithId[] = allUsersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data() as any
            }));

            console.log(`📊 Processing ${allUsers.length} users`);

            // Enhanced crush count calculation with better name matching
            const crushCounts = new Map<string, number>();

            for (const user of allUsers) {
                const userCrushes = user.crushes || [];
                for (const crushName of userCrushes) {
                    // Find the actual user that matches this crush name
                    const targetUser = findUserByName(crushName, allUsers);

                    if (targetUser) {
                        // Use verifiedName if available, otherwise displayName
                        const actualName = targetUser.verifiedName || targetUser.displayName;
                        if (actualName) {
                            crushCounts.set(actualName, (crushCounts.get(actualName) || 0) + 1);
                        }
                    } else {
                        // If no user found, still count it but use the crush name directly
                        // This handles cases where someone hasn't signed up yet or name doesn't match
                        console.log(`⚠️ No user found for crush name: "${crushName}" - counting anyway`);
                        crushCounts.set(crushName, (crushCounts.get(crushName) || 0) + 1);
                    }
                }
            }

            console.log('💕 Enhanced crush counts calculated:', Object.fromEntries(crushCounts));

            // Calculate matches and locked crushes with enhanced matching
            const allMatches = new Map<string, MatchInfo[]>();
            const allLockedCrushes = new Map<string, string[]>();

            for (const user of allUsers) {
                const userMatches: MatchInfo[] = [];
                const userLockedCrushes: string[] = [];
                const userCrushes = user.crushes || [];
                const userIdentityName = user.verifiedName || user.displayName;

                if (!userIdentityName || !userIdentityName.trim()) {
                    console.log(`⏭️ Skipping user ${user.id} - no identity name`);
                    allMatches.set(user.id, userMatches);
                    allLockedCrushes.set(user.id, userLockedCrushes);
                    continue;
                }

                // Find mutual matches with enhanced name matching
                for (const crushName of userCrushes) {
                    const crushedUser = findUserByName(crushName, allUsers);

                    if (!crushedUser) {
                        console.log(`⚠️ No user found for crush name: "${crushName}"`);
                        continue;
                    }

                    const crushedUserCrushes = crushedUser.crushes || [];

                    // Check if it's a mutual match using enhanced matching
                    const hasMutualCrush = crushedUserCrushes.some(crush => {
                        const matchedUser = findUserByName(crush, allUsers);
                        return matchedUser && matchedUser.id === user.id;
                    });

                    if (hasMutualCrush) {
                        const crushedUserIdentityName = crushedUser.verifiedName || crushedUser.displayName;
                        userMatches.push({
                            name: crushedUserIdentityName,
                            email: crushedUser.email
                        });

                        // Lock this crush ONLY if there's a mutual match
                        if (!userLockedCrushes.includes(crushName)) {
                            userLockedCrushes.push(crushName);
                        }

                        console.log(`💕 Match found: ${userIdentityName} ↔ ${crushedUserIdentityName}`);
                    }
                }

                allMatches.set(user.id, userMatches);
                allLockedCrushes.set(user.id, userLockedCrushes);
            }

            // Update all users with their matches, crush counts, and locked crushes
            for (const user of allUsers) {
                const userRef = db.collection('users').doc(user.id);
                const userIdentityName = user.verifiedName || user.displayName;

                // For crush count, we need to check both verifiedName and displayName
                // because someone might be crushing on "Ludwig Neumann" but he only has displayName
                let userCrushCount = 0;
                if (userIdentityName) {
                    userCrushCount = crushCounts.get(userIdentityName) || 0;

                    // Also check if anyone is crushing on their alternate name
                    const alternateName = user.verifiedName ? user.displayName : user.verifiedName;
                    if (alternateName && alternateName !== userIdentityName) {
                        userCrushCount += crushCounts.get(alternateName) || 0;
                    }
                }

                const updateData = {
                    matches: allMatches.get(user.id) || [],
                    lockedCrushes: allLockedCrushes.get(user.id) || [],
                    crushCount: userCrushCount,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };

                transaction.update(userRef, updateData);
            }

            console.log(`✅ Updated all ${allUsers.length} users with enhanced matches and crush counts`);
        });

    } catch (error) {
        console.error('❌ Error in enhanced processUpdatedCrushes:', error);
        throw error;
    }
}