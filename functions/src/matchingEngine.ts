import * as admin from 'firebase-admin';
import { UserWithId, MatchInfo } from './types';
import { findUserByName, getUserIdentityName } from './utils';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// Enhanced function to recalculate all matches and crush counts with better name matching
// Now respects class boundaries - GSB students can only match with GSB, undergrads with undergrads
export async function processUpdatedCrushes(): Promise<void> {
    console.log('🔄 Starting enhanced recalculation of all matches and crush counts with class separation...');

    try {
        await db.runTransaction(async (transaction) => {
            // Get all users
            const allUsersSnapshot = await transaction.get(db.collection('users'));

            const allUsers: UserWithId[] = allUsersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data() as any
            }));

            console.log(`📊 Processing ${allUsers.length} users`);

            // Separate users by class
            const gsbUsers = allUsers.filter(user => user.userClass === 'gsb' || !user.userClass); // Default to GSB for backwards compatibility
            const undergradUsers = allUsers.filter(user => user.userClass === 'undergrad');

            console.log(`📊 GSB users: ${gsbUsers.length}, Undergrad users: ${undergradUsers.length}`);

            // Enhanced crush count calculation with better name matching and class separation
            const crushCounts = new Map<string, number>();
            const crushersMap = new Map<string, string[]>(); // Track who is crushing on whom

            // Process GSB users
            for (const user of gsbUsers) {
                const userCrushes = user.crushes || [];
                for (const crushName of userCrushes) {
                    // Find the actual user that matches this crush name within GSB class
                    const targetUser = findUserByName(crushName, gsbUsers, 'gsb');

                    if (targetUser) {
                        // Use the user's identity name
                        const actualName = getUserIdentityName(targetUser);
                        if (actualName) {
                            const key = `gsb:${actualName}`;
                            crushCounts.set(key, (crushCounts.get(key) || 0) + 1);

                            // Track the crusher
                            if (!crushersMap.has(key)) {
                                crushersMap.set(key, []);
                            }
                            crushersMap.get(key)!.push(getUserIdentityName(user) || user.email);
                        }
                    } else {
                        // If no user found, still count it but use the crush name directly
                        console.log(`⚠️ No GSB user found for crush name: "${crushName}" - counting anyway`);
                        const key = `gsb:${crushName}`;
                        crushCounts.set(key, (crushCounts.get(key) || 0) + 1);

                        // Track the crusher for orphaned crushes too
                        if (!crushersMap.has(key)) {
                            crushersMap.set(key, []);
                        }
                        crushersMap.get(key)!.push(getUserIdentityName(user) || user.email);
                    }
                }
            }

            // Process Undergrad users
            for (const user of undergradUsers) {
                const userCrushes = user.crushes || [];
                for (const crushName of userCrushes) {
                    // Find the actual user that matches this crush name within undergrad class
                    const targetUser = findUserByName(crushName, undergradUsers, 'undergrad');

                    if (targetUser) {
                        // Use the user's identity name
                        const actualName = getUserIdentityName(targetUser);
                        if (actualName) {
                            const key = `undergrad:${actualName}`;
                            crushCounts.set(key, (crushCounts.get(key) || 0) + 1);

                            // Track the crusher
                            if (!crushersMap.has(key)) {
                                crushersMap.set(key, []);
                            }
                            crushersMap.get(key)!.push(getUserIdentityName(user) || user.email);
                        }
                    } else {
                        // If no user found, still count it but use the crush name directly
                        console.log(`⚠️ No undergrad user found for crush name: "${crushName}" - counting anyway`);
                        const key = `undergrad:${crushName}`;
                        crushCounts.set(key, (crushCounts.get(key) || 0) + 1);

                        // Track the crusher for orphaned crushes too
                        if (!crushersMap.has(key)) {
                            crushersMap.set(key, []);
                        }
                        crushersMap.get(key)!.push(getUserIdentityName(user) || user.email);
                    }
                }
            }

            console.log('💕 Enhanced crush counts calculated:', Object.fromEntries(crushCounts));

            // Calculate matches and locked crushes with enhanced matching and class separation
            const allMatches = new Map<string, MatchInfo[]>();
            const allLockedCrushes = new Map<string, string[]>();

            // Use actual Firestore Timestamp for all new matches
            const currentTimestamp = admin.firestore.Timestamp.now();

            // Process both classes together but only allow matches within same class
            for (const user of allUsers) {
                const userMatches: MatchInfo[] = [];
                const userLockedCrushes: string[] = [];
                const userCrushes = user.crushes || [];
                const userIdentityName = getUserIdentityName(user);
                const userClass = user.userClass || 'gsb'; // Default to GSB for backwards compatibility

                if (!userIdentityName || !userIdentityName.trim()) {
                    console.log(`⏭️ Skipping user ${user.id} - no identity name`);
                    allMatches.set(user.id, userMatches);
                    allLockedCrushes.set(user.id, userLockedCrushes);
                    continue;
                }

                // Get users from the same class only
                const sameClassUsers = allUsers.filter(u => (u.userClass || 'gsb') === userClass);

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

                        // Determine if this match should have a timestamp
                        const shouldHaveTimestamp = shouldMatchHaveTimestamp(userIdentityName, crushedUserIdentityName);

                        const matchInfo: MatchInfo = {
                            name: crushedUserIdentityName,
                            email: crushedUser.email,
                            ...(shouldHaveTimestamp && { matchedAt: currentTimestamp })
                        };

                        userMatches.push(matchInfo);

                        // Lock this crush ONLY if there's a mutual match
                        if (!userLockedCrushes.includes(crushName)) {
                            userLockedCrushes.push(crushName);
                        }

                        const timestampStatus = shouldHaveTimestamp ? 'WITH_TIMESTAMP' : 'NO_TIMESTAMP';
                        console.log(`💕 ${userClass.toUpperCase()} Match (${timestampStatus}): ${userIdentityName} ↔ ${crushedUserIdentityName}`);
                    }
                }

                allMatches.set(user.id, userMatches);
                allLockedCrushes.set(user.id, userLockedCrushes);
            }

            // Update all users with their matches, crush counts, and locked crushes
            for (const user of allUsers) {
                const userRef = db.collection('users').doc(user.id);
                const userIdentityName = getUserIdentityName(user);
                const userClass = user.userClass || 'gsb'; // Default to GSB for backwards compatibility

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
                    userClass: userClass, // Ensure userClass is set for legacy users
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };

                transaction.update(userRef, updateData);
            }

            console.log(`✅ Updated all ${allUsers.length} users with enhanced matches and crush counts (class-separated)`);
        });

    } catch (error) {
        console.error('❌ Error in enhanced processUpdatedCrushes:', error);
        throw error;
    }
}

// Helper function to determine if a match should have a timestamp
function shouldMatchHaveTimestamp(user1Name: string, user2Name: string): boolean {
    // Check if this is a match between James Park and Test Account (GSB)
    const isJamesVsTestAccount =
        (user1Name === 'James Park' && user2Name === 'Test Account (GSB)') ||
        (user1Name === 'Test Account (GSB)' && user2Name === 'James Park');

    // Skip timestamp for James Park vs Test Account (GSB)
    if (isJamesVsTestAccount) {
        return false;
    }

    // All other matches should have timestamps
    return true;
}

// New function to manually fix all crush count discrepancies
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

// One-time function to fix all timestamp issues permanently
export async function fixAllMatchTimestampsOnce(): Promise<void> {
    console.log('🔧 Starting one-time fix for all match timestamps...');

    try {
        await db.runTransaction(async (transaction) => {
            // Get all users
            const allUsersSnapshot = await transaction.get(db.collection('users'));
            const currentTimestamp = admin.firestore.Timestamp.now();

            let updatedUsers = 0;
            let fixedMatches = 0;

            allUsersSnapshot.forEach(doc => {
                const userData = doc.data();
                const matches = userData.matches || [];
                const userId = doc.id;
                const userName = userData.name || userData.verifiedName || userData.displayName || userData.email;

                if (matches.length > 0) {
                    let needsUpdate = false;
                    const updatedMatches = matches.map((match: any) => {
                        const shouldHaveTimestamp = shouldMatchHaveTimestamp(userName, match.name);

                        if (shouldHaveTimestamp) {
                            // Add or update timestamp for matches that should have one
                            needsUpdate = true;
                            fixedMatches++;
                            console.log(`🔧 Setting timestamp for match: ${match.name} ↔ ${userName}`);
                            return {
                                name: match.name || 'Unknown',
                                email: match.email || 'unknown@stanford.edu',
                                matchedAt: currentTimestamp
                            };
                        } else {
                            // Remove timestamp for matches that shouldn't have one
                            if (match.matchedAt) {
                                needsUpdate = true;
                                console.log(`🔧 Removing timestamp for match: ${match.name} ↔ ${userName}`);
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
                        updatedUsers++;
                    }
                }
            });

            console.log(`✅ Fixed timestamps for ${fixedMatches} matches across ${updatedUsers} users`);
        });
    } catch (error) {
        console.error('❌ Error fixing all match timestamps:', error);
        throw error;
    }
}

// Legacy function - keeping for backward compatibility
export async function fixMissingMatchTimestamps(): Promise<void> {
    await fixAllMatchTimestampsOnce();
}