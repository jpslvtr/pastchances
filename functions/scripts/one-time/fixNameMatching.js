const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'stanford-lastchances',
});

const db = admin.firestore();

// Helper function to normalize names for matching
function normalizeName(name) {
    if (!name || typeof name !== 'string') return '';
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Function to find the best match for a name from the class list
function findBestMatch(targetName, classList) {
    const normalizedTarget = normalizeName(targetName);

    // First try exact match
    const exactMatch = classList.find(name => normalizeName(name) === normalizedTarget);
    if (exactMatch) return exactMatch;

    // Then try partial matches (removing middle names, etc.)
    const targetParts = normalizedTarget.split(' ');
    if (targetParts.length >= 2) {
        const firstLast = `${targetParts[0]} ${targetParts[targetParts.length - 1]}`;

        const partialMatch = classList.find(name => {
            const nameParts = normalizeName(name).split(' ');
            if (nameParts.length >= 2) {
                const nameFirstLast = `${nameParts[0]} ${nameParts[nameParts.length - 1]}`;
                return nameFirstLast === firstLast;
            }
            return false;
        });

        if (partialMatch) return partialMatch;
    }

    return null;
}

async function fixNameMatching() {
    try {
        console.log('🔧 Starting comprehensive name matching fix...\n');

        // Get all users
        const usersSnapshot = await db.collection('users').get();
        const allUsers = [];
        const allVerifiedNames = new Set();
        const allDisplayNames = new Set();

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            allUsers.push({
                id: doc.id,
                uid: userData.uid,
                email: userData.email,
                displayName: userData.displayName,
                photoURL: userData.photoURL,
                verifiedName: userData.verifiedName,
                crushes: userData.crushes || [],
                lockedCrushes: userData.lockedCrushes || [],
                matches: userData.matches || [],
                crushCount: userData.crushCount || 0,
                createdAt: userData.createdAt,
                updatedAt: userData.updatedAt,
                lastLogin: userData.lastLogin
            });

            if (userData.verifiedName && userData.verifiedName.trim()) {
                allVerifiedNames.add(userData.verifiedName.trim());
            }
            if (userData.displayName && userData.displayName.trim()) {
                allDisplayNames.add(userData.displayName.trim());
            }
        });

        console.log(`Found ${allUsers.length} total users`);
        console.log(`Found ${allVerifiedNames.size} users with verified names`);
        console.log(`Found ${allDisplayNames.size} users with display names\n`);

        // Create a comprehensive list of all possible names to match against
        const allPossibleNames = new Set([...allVerifiedNames, ...allDisplayNames]);
        const namesList = Array.from(allPossibleNames);

        console.log(`Using ${namesList.length} possible names for matching\n`);

        // Build mapping of crushes to actual names
        const crushNameMapping = new Map();
        let mappingStats = { exact: 0, partial: 0, notFound: 0 };

        // Get all unique crush names from all users
        const allCrushNames = new Set();
        for (const user of allUsers) {
            const crushes = user.crushes || [];
            for (const crushName of crushes) {
                allCrushNames.add(crushName);
            }
        }

        console.log(`Found ${allCrushNames.size} unique crush names to map\n`);

        // Map each crush name to an actual user name
        for (const crushName of allCrushNames) {
            const bestMatch = findBestMatch(crushName, namesList);

            if (bestMatch) {
                if (normalizeName(bestMatch) === normalizeName(crushName)) {
                    mappingStats.exact++;
                } else {
                    mappingStats.partial++;
                    console.log(`📝 Mapping "${crushName}" -> "${bestMatch}"`);
                }
                crushNameMapping.set(crushName, bestMatch);
            } else {
                mappingStats.notFound++;
                console.log(`❌ No match found for "${crushName}"`);
                crushNameMapping.set(crushName, null);
            }
        }

        console.log('\n📊 Mapping Statistics:');
        console.log(`  Exact matches: ${mappingStats.exact}`);
        console.log(`  Partial matches: ${mappingStats.partial}`);
        console.log(`  Not found: ${mappingStats.notFound}\n`);

        // Now recalculate everything with the corrected mappings
        console.log('🔄 Recalculating crush counts and matches with corrected mappings...\n');

        // Calculate crush counts for users based on their verifiedName or displayName
        const crushCounts = new Map();

        for (const user of allUsers) {
            const userCrushes = user.crushes || [];
            for (const crushName of userCrushes) {
                const actualName = crushNameMapping.get(crushName);
                if (actualName) {
                    // Find the user with this name (either verifiedName or displayName)
                    const targetUser = allUsers.find(u =>
                        (u.verifiedName && normalizeName(u.verifiedName) === normalizeName(actualName)) ||
                        (u.displayName && normalizeName(u.displayName) === normalizeName(actualName))
                    );

                    if (targetUser) {
                        // Use verifiedName if available, otherwise displayName
                        const keyName = targetUser.verifiedName || targetUser.displayName;
                        if (keyName) {
                            crushCounts.set(keyName, (crushCounts.get(keyName) || 0) + 1);
                        }
                    }
                }
            }
        }

        console.log(`💕 Calculated crush counts for ${crushCounts.size} people`);

        // Calculate matches and locked crushes
        const allMatches = new Map();
        const allLockedCrushes = new Map();
        let totalMatchPairs = 0;

        for (const user of allUsers) {
            const userMatches = [];
            const userLockedCrushes = [...(user.lockedCrushes || [])];
            const userCrushes = user.crushes || [];
            const userIdentityName = user.verifiedName || user.displayName;

            if (!userIdentityName || !userIdentityName.trim()) {
                allMatches.set(user.id, userMatches);
                allLockedCrushes.set(user.id, userLockedCrushes);
                continue;
            }

            // Find mutual matches
            for (const crushName of userCrushes) {
                const actualCrushName = crushNameMapping.get(crushName);
                if (!actualCrushName) continue;

                // Find the user with this name
                const crushedUser = allUsers.find(u =>
                    (u.verifiedName && normalizeName(u.verifiedName) === normalizeName(actualCrushName)) ||
                    (u.displayName && normalizeName(u.displayName) === normalizeName(actualCrushName))
                );

                if (!crushedUser) continue;

                const crushedUserCrushes = crushedUser.crushes || [];
                const crushedUserIdentityName = crushedUser.verifiedName || crushedUser.displayName;

                // Check if it's a mutual match
                const hasMutualCrush = crushedUserCrushes.some(crush => {
                    const actualCrushBack = crushNameMapping.get(crush);
                    return actualCrushBack && normalizeName(actualCrushBack) === normalizeName(userIdentityName);
                });

                if (hasMutualCrush) {
                    userMatches.push({
                        name: crushedUserIdentityName,
                        email: crushedUser.email
                    });

                    // Lock this crush
                    if (!userLockedCrushes.includes(crushName)) {
                        userLockedCrushes.push(crushName);
                    }

                    totalMatchPairs++;
                }
            }

            allMatches.set(user.id, userMatches);
            allLockedCrushes.set(user.id, userLockedCrushes);
        }

        console.log(`🎉 Found ${totalMatchPairs} total match instances`);

        // Update all users in batches
        console.log('\n📝 Updating user documents...');

        const batchSize = 500;
        const batches = [];
        let currentBatch = db.batch();
        let operationCount = 0;

        for (const user of allUsers) {
            const userRef = db.collection('users').doc(user.id);
            const userIdentityName = user.verifiedName || user.displayName;
            const updateData = {
                matches: allMatches.get(user.id) || [],
                lockedCrushes: allLockedCrushes.get(user.id) || [],
                crushCount: crushCounts.get(userIdentityName) || 0,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            currentBatch.update(userRef, updateData);
            operationCount++;

            if (operationCount === batchSize) {
                batches.push(currentBatch);
                currentBatch = db.batch();
                operationCount = 0;
            }
        }

        if (operationCount > 0) {
            batches.push(currentBatch);
        }

        // Execute all batches
        console.log(`Executing ${batches.length} batches...`);
        await Promise.all(batches.map(batch => batch.commit()));

        console.log(`\n✅ Successfully updated all ${allUsers.length} users!`);
        console.log(`📊 Final Statistics:`);
        console.log(`   Total match instances found: ${totalMatchPairs}`);
        console.log(`   People with crush counts > 0: ${Array.from(crushCounts.values()).filter(count => count > 0).length}`);

        const totalCrushes = Array.from(crushCounts.values()).reduce((a, b) => a + b, 0);
        console.log(`   Total crushes distributed: ${totalCrushes}`);

        // Show users who now have crush counts
        console.log('\n🎯 Users with updated crush counts:');
        for (const user of allUsers) {
            const userIdentityName = user.verifiedName || user.displayName;
            const newCount = crushCounts.get(userIdentityName) || 0;
            const oldCount = user.crushCount || 0;
            if (newCount !== oldCount) {
                console.log(`   ${userIdentityName || 'Unknown'}: ${oldCount} -> ${newCount}`);
            }
        }

    } catch (error) {
        console.error('❌ Error in fixNameMatching:', error);
    }
}

fixNameMatching();