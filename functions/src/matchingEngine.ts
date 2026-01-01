import * as admin from 'firebase-admin';
import { UserWithId, MatchInfo } from './types';
import { findUserByName, getUserIdentityName } from './utils';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// Incremental update - only processes users affected by the change
export async function processIncrementalUpdate(
    userId: string,
    beforeCrushes: string[],
    afterCrushes: string[],
    userName: string,
    userClass: string
): Promise<void> {
    console.log(`🚀 Starting incremental update for ${userName}`);

    try {
        await db.runTransaction(async (transaction) => {
            // Find users whose state might have changed
            const added = afterCrushes.filter(c => !beforeCrushes.includes(c));
            const removed = beforeCrushes.filter(c => !afterCrushes.includes(c));

            console.log(`➕ Added crushes: ${added.join(', ')}`);
            console.log(`➖ Removed crushes: ${removed.join(', ')}`);

            // Get all users in this class (needed for name lookups)
            const allUsersSnapshot = await transaction.get(
                db.collection('users').where('userClass', '==', userClass)
            );

            const allUsers: UserWithId[] = allUsersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data() as any
            }));

            // Set of user IDs that need updates
            const affectedUserIds = new Set<string>();
            affectedUserIds.add(userId); // The user who made the change

            // Find users affected by additions
            for (const crushName of added) {
                const crushedUser = findUserByName(crushName, allUsers, userClass);
                if (crushedUser) {
                    affectedUserIds.add(crushedUser.id);
                }
            }

            // Find users affected by removals
            for (const crushName of removed) {
                const crushedUser = findUserByName(crushName, allUsers, userClass);
                if (crushedUser) {
                    affectedUserIds.add(crushedUser.id);
                }
            }

            console.log(`👥 Affected users: ${affectedUserIds.size}`);

            // Create single timestamp for this batch of updates (ensures consistency)
            const batchTimestamp = admin.firestore.Timestamp.now();

            // For each affected user, recalculate their matches and crushCount
            for (const affectedId of affectedUserIds) {
                const affectedUser = allUsers.find(u => u.id === affectedId);
                if (!affectedUser) continue;

                const affectedUserName = getUserIdentityName(affectedUser);
                if (!affectedUserName) continue;

                // Recalculate crushCount for this user
                let crushCount = 0;
                for (const user of allUsers) {
                    const userCrushes = user.crushes || [];
                    for (const crushName of userCrushes) {
                        const targetUser = findUserByName(crushName, allUsers, userClass);
                        if (targetUser && targetUser.id === affectedId) {
                            crushCount++;
                        }
                    }
                }

                // Recalculate matches for this user
                const userCrushes = affectedUser.crushes || [];
                const existingMatches = affectedUser.matches || [];
                const existingMatchMap = new Map<string, any>();
                existingMatches.forEach(match => {
                    if (match.name) {
                        existingMatchMap.set(match.name, match);
                    }
                });

                const userMatches: MatchInfo[] = [];
                const userLockedCrushes: string[] = [];

                for (const crushName of userCrushes) {
                    const crushedUser = findUserByName(crushName, allUsers, userClass);
                    if (!crushedUser) continue;

                    const crushedUserName = getUserIdentityName(crushedUser);
                    if (!crushedUserName) continue;

                    const crushedUserCrushes = crushedUser.crushes || [];

                    // Check if it's a mutual crush
                    const isMutual = crushedUserCrushes.some(crushBack => {
                        const matchedUser = findUserByName(crushBack, allUsers, userClass);
                        return matchedUser && matchedUser.id === affectedId;
                    });

                    if (isMutual) {
                        const existingMatch = existingMatchMap.get(crushedUserName);

                        if (existingMatch && existingMatch.matchedAt) {
                            // Preserve existing timestamp
                            userMatches.push({
                                name: crushedUserName,
                                email: crushedUser.email || 'unknown@stanford.edu',
                                matchedAt: existingMatch.matchedAt
                            });
                            console.log(`🔒 Preserving existing timestamp for ${affectedUserName} ↔ ${crushedUserName}`);
                        } else {
                            // New match - add timestamp using batch timestamp for consistency
                            userMatches.push({
                                name: crushedUserName,
                                email: crushedUser.email || 'unknown@stanford.edu',
                                matchedAt: batchTimestamp
                            });
                            console.log(`🆕 New match with timestamp: ${affectedUserName} ↔ ${crushedUserName}`);
                        }

                        userLockedCrushes.push(crushedUserName);
                    }
                }

                // Update this affected user
                const userRef = db.collection('users').doc(affectedId);
                transaction.update(userRef, {
                    matches: userMatches,
                    lockedCrushes: userLockedCrushes,
                    crushCount: crushCount,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            console.log(`✅ Updated ${affectedUserIds.size} affected users`);
        });

    } catch (error) {
        console.error('❌ Error in processIncrementalUpdate:', error);
        throw error;
    }
}

// Full recalculation of all matches and crush counts
export async function processUpdatedCrushes(): Promise<void> {
    console.log('🔄 Starting full match and crush count recalculation...');

    try {
        await db.runTransaction(async (transaction) => {
            // Get all users from both classes
            const gsbSnapshot = await transaction.get(db.collection('users').where('userClass', '==', 'gsb'));
            const undergradSnapshot = await transaction.get(db.collection('users').where('userClass', '==', 'undergrad'));

            const allUsers: UserWithId[] = [
                ...gsbSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any })),
                ...undergradSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }))
            ];

            console.log(`📊 Total users: ${allUsers.length} (GSB: ${gsbSnapshot.size}, Undergrad: ${undergradSnapshot.size})`);

            // Calculate crush counts for each user (by class)
            const crushCounts = new Map<string, number>();
            const crushersMap = new Map<string, string[]>();

            for (const user of allUsers) {
                const userCrushes = user.crushes || [];
                const userIdentityName = getUserIdentityName(user);
                const userClass = user.userClass || 'gsb';

                if (!userIdentityName || !userIdentityName.trim()) {
                    console.log(`⏭️ Skipping user ${user.id} - no identity name`);
                    continue;
                }

                const sameClassUsers = allUsers.filter(u => (u.userClass || 'gsb') === userClass);

                for (const crushName of userCrushes) {
                    const targetUser = findUserByName(crushName, sameClassUsers, userClass);

                    if (targetUser) {
                        const targetUserIdentityName = getUserIdentityName(targetUser);
                        if (targetUserIdentityName) {
                            const key = `${userClass}:${targetUserIdentityName}`;
                            crushCounts.set(key, (crushCounts.get(key) || 0) + 1);

                            const crushers = crushersMap.get(key) || [];
                            crushers.push(userIdentityName);
                            crushersMap.set(key, crushers);
                        }
                    }
                }
            }

            // Calculate matches for all users
            const allMatches = new Map<string, MatchInfo[]>();
            const allLockedCrushes = new Map<string, string[]>();

            // Process both classes together but only allow matches within same class
            for (const user of allUsers) {
                const userMatches: MatchInfo[] = [];
                const userLockedCrushes: string[] = [];
                const userCrushes = user.crushes || [];
                const userIdentityName = getUserIdentityName(user);
                const userClass = user.userClass || 'gsb';

                if (!userIdentityName || !userIdentityName.trim()) {
                    console.log(`⏭️ Skipping user ${user.id} - no identity name`);
                    allMatches.set(user.id, userMatches);
                    allLockedCrushes.set(user.id, userLockedCrushes);
                    continue;
                }

                // Get users from the same class only
                const sameClassUsers = allUsers.filter(u => (u.userClass || 'gsb') === userClass);

                // Get existing matches to preserve timestamps
                const existingMatches = user.matches || [];
                const existingMatchMap = new Map<string, any>();
                existingMatches.forEach(match => {
                    if (match.name) {
                        existingMatchMap.set(match.name, match);
                    }
                });

                // Find mutual matches with enhanced name matching within same class
                for (const crushName of userCrushes) {
                    const crushedUser = findUserByName(crushName, sameClassUsers, userClass);

                    if (!crushedUser) {
                        console.log(`⚠️ No ${userClass} user found for crush name: "${crushName}"`);
                        continue;
                    }

                    const crushedUserCrushes = crushedUser.crushes || [];

                    // Check if it's a mutual match using enhanced matching within same class
                    const hasMutualCrush = crushedUserCrushes.some(crush => {
                        const matchedUser = findUserByName(crush, sameClassUsers, userClass);
                        return matchedUser && matchedUser.id === user.id;
                    });

                    if (hasMutualCrush) {
                        const crushedUserIdentityName = getUserIdentityName(crushedUser);

                        // Check if this is an existing match to preserve timestamp
                        const existingMatch = existingMatchMap.get(crushedUserIdentityName);

                        let matchInfo: MatchInfo;

                        if (existingMatch && existingMatch.matchedAt) {
                            // Preserve the exact existing timestamp object
                            matchInfo = {
                                name: crushedUserIdentityName,
                                email: crushedUser.email,
                                matchedAt: existingMatch.matchedAt
                            };
                            console.log(`🔒 Preserving existing timestamp for ${userIdentityName} ↔ ${crushedUserIdentityName}`);
                        } else {
                            // New match - create timestamp at the exact moment this match is discovered
                            matchInfo = {
                                name: crushedUserIdentityName,
                                email: crushedUser.email,
                                matchedAt: admin.firestore.Timestamp.now()
                            };
                            console.log(`🆕 Creating new timestamp for ${userIdentityName} ↔ ${crushedUserIdentityName}`);
                        }

                        userMatches.push(matchInfo);

                        // Lock this crush ONLY if there's a mutual match
                        if (!userLockedCrushes.includes(crushName)) {
                            userLockedCrushes.push(crushName);
                        }

                        const isNewMatch = !existingMatchMap.has(crushedUserIdentityName);
                        const timestampStatus = isNewMatch ? 'NEW_TIMESTAMP' : 'PRESERVED_EXISTING';
                        console.log(`💕 ${userClass.toUpperCase()} Match ${isNewMatch ? 'NEW' : 'EXISTING'} (${timestampStatus}): ${userIdentityName} ↔ ${crushedUserIdentityName}`);
                    }
                }

                allMatches.set(user.id, userMatches);
                allLockedCrushes.set(user.id, userLockedCrushes);
            }

            // Update all users with their matches, crush counts, and locked crushes
            for (const user of allUsers) {
                const userRef = db.collection('users').doc(user.id);
                const userIdentityName = getUserIdentityName(user);
                const userClass = user.userClass || 'gsb';

                // For crush count, we need to check the user's identity name with class prefix
                let userCrushCount = 0;
                if (userIdentityName) {
                    const key = `${userClass}:${userIdentityName}`;
                    userCrushCount = crushCounts.get(key) || 0;

                    // Log discrepancies for debugging
                    const currentCrushCount = user.crushCount || 0;
                    if (currentCrushCount !== userCrushCount) {
                        const crushers = crushersMap.get(key) || [];
                        console.log(`🔧 Fixing crush count for ${userIdentityName}: ${currentCrushCount} -> ${userCrushCount} (crushers: ${crushers.join(', ')})`);
                    }
                }

                const updateData = {
                    matches: allMatches.get(user.id) || [],
                    lockedCrushes: allLockedCrushes.get(user.id) || [],
                    crushCount: userCrushCount,
                    userClass: userClass,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };

                transaction.update(userRef, updateData);
            }

            console.log(`✅ Updated all ${allUsers.length} users with enhanced matches and crush counts (class-separated)`);
        });

    } catch (error) {
        console.error('❌ Error in processUpdatedCrushes:', error);
        throw error;
    }
}

// Manual function to fix crush count discrepancies
export async function fixAllCrushCounts(): Promise<void> {
    console.log('🔧 Starting manual fix of all crush count discrepancies...');

    try {
        await processUpdatedCrushes();
        console.log('✅ All crush counts have been synchronized');
    } catch (error) {
        console.error('❌ Error fixing crush counts:', error);
        throw error;
    }
}