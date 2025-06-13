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

async function fixOrphanedCrushNames() {
    try {
        console.log('🔧 Starting comprehensive orphaned crush names cleanup...\n');

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
        });

        console.log(`Found ${allUsers.length} total users\n`);

        // Build current identity mapping - every user's current identity
        const currentIdentities = new Map(); // uid -> current name
        const nameToUser = new Map(); // current name -> user object

        for (const user of allUsers) {
            const currentName = user.verifiedName || user.displayName;
            if (currentName && currentName.trim()) {
                currentIdentities.set(user.uid, currentName);
                nameToUser.set(normalizeName(currentName), user);
            }
        }

        console.log(`Mapped ${currentIdentities.size} users to their current identities\n`);

        // Get all unique crush names from all users
        const allCrushNames = new Set();
        for (const user of allUsers) {
            const crushes = user.crushes || [];
            for (const crushName of crushes) {
                if (crushName && crushName.trim()) {
                    allCrushNames.add(crushName);
                }
            }
        }

        console.log(`Found ${allCrushNames.size} unique crush names to analyze\n`);

        // Categorize crush names
        const validCrushNames = new Set();
        const orphanedCrushNames = new Set();

        for (const crushName of allCrushNames) {
            const normalizedCrush = normalizeName(crushName);

            // Check if this crush name matches any current user identity
            if (nameToUser.has(normalizedCrush)) {
                validCrushNames.add(crushName);
            } else {
                orphanedCrushNames.add(crushName);
            }
        }

        console.log(`📊 Analysis Results:`);
        console.log(`   Valid crush names (match current users): ${validCrushNames.size}`);
        console.log(`   Orphaned crush names (no matching user): ${orphanedCrushNames.size}\n`);

        if (orphanedCrushNames.size === 0) {
            console.log('✅ No orphaned crush names found! All crushes are properly mapped.');
            return;
        }

        console.log('❌ Orphaned crush names found:');
        orphanedCrushNames.forEach(name => {
            console.log(`   - "${name}"`);
        });
        console.log('');

        // Try to map orphaned names to current user identities
        const crushNameMapping = new Map();
        let mappingStats = { mapped: 0, unmapped: 0 };

        for (const orphanedName of orphanedCrushNames) {
            let foundMapping = false;

            // Strategy 1: Check if this was someone's old verifiedName or displayName
            // by looking at historical data or checking if the email pattern matches

            // Strategy 2: Manual mappings for known cases
            const knownMappings = {
                'Carolyn Bruckmann': 'Shailee Samar', // Known case from the user
                // Add other known mappings here if needed
            };

            if (knownMappings[orphanedName]) {
                const targetName = knownMappings[orphanedName];
                const targetUser = nameToUser.get(normalizeName(targetName));
                if (targetUser) {
                    crushNameMapping.set(orphanedName, targetName);
                    console.log(`📝 Manual mapping: "${orphanedName}" -> "${targetName}"`);
                    mappingStats.mapped++;
                    foundMapping = true;
                }
            }

            // Strategy 3: Try partial name matching (first + last name)
            if (!foundMapping) {
                const orphanedParts = normalizeName(orphanedName).split(' ');
                if (orphanedParts.length >= 2) {
                    const orphanedFirstLast = `${orphanedParts[0]} ${orphanedParts[orphanedParts.length - 1]}`;

                    for (const [normalizedCurrentName, user] of nameToUser) {
                        const currentParts = normalizedCurrentName.split(' ');
                        if (currentParts.length >= 2) {
                            const currentFirstLast = `${currentParts[0]} ${currentParts[currentParts.length - 1]}`;
                            if (currentFirstLast === orphanedFirstLast) {
                                const actualCurrentName = user.verifiedName || user.displayName;
                                crushNameMapping.set(orphanedName, actualCurrentName);
                                console.log(`📝 Partial match mapping: "${orphanedName}" -> "${actualCurrentName}"`);
                                mappingStats.mapped++;
                                foundMapping = true;
                                break;
                            }
                        }
                    }
                }
            }

            if (!foundMapping) {
                console.log(`❌ Could not map orphaned name: "${orphanedName}"`);
                mappingStats.unmapped++;
            }
        }

        console.log(`\n📊 Mapping Results:`);
        console.log(`   Successfully mapped: ${mappingStats.mapped}`);
        console.log(`   Could not map: ${mappingStats.unmapped}\n`);

        if (mappingStats.mapped === 0) {
            console.log('❌ No mappings found. Cannot proceed with cleanup.');
            return;
        }

        // Apply the mappings to all users' crush lists
        console.log('🔄 Updating user crush lists with corrected names...\n');

        let updatedUsersCount = 0;
        const batchSize = 500;
        const batches = [];
        let currentBatch = db.batch();
        let operationCount = 0;

        for (const user of allUsers) {
            const originalCrushes = user.crushes || [];
            let updatedCrushes = [...originalCrushes];
            let hasChanges = false;

            // Apply mappings
            for (let i = 0; i < updatedCrushes.length; i++) {
                const crushName = updatedCrushes[i];
                if (crushNameMapping.has(crushName)) {
                    updatedCrushes[i] = crushNameMapping.get(crushName);
                    hasChanges = true;
                    console.log(`   ${user.verifiedName || user.displayName || user.email}: "${crushName}" -> "${updatedCrushes[i]}"`);
                }
            }

            // Remove duplicates that might result from mapping
            if (hasChanges) {
                updatedCrushes = [...new Set(updatedCrushes)];
            }

            // Also update lockedCrushes
            const originalLockedCrushes = user.lockedCrushes || [];
            let updatedLockedCrushes = [...originalLockedCrushes];

            for (let i = 0; i < updatedLockedCrushes.length; i++) {
                const lockedCrush = updatedLockedCrushes[i];
                if (crushNameMapping.has(lockedCrush)) {
                    updatedLockedCrushes[i] = crushNameMapping.get(lockedCrush);
                    hasChanges = true;
                }
            }

            if (hasChanges) {
                updatedLockedCrushes = [...new Set(updatedLockedCrushes)];
            }

            if (hasChanges || JSON.stringify(originalCrushes) !== JSON.stringify(updatedCrushes)) {
                const userRef = db.collection('users').doc(user.id);
                currentBatch.update(userRef, {
                    crushes: updatedCrushes,
                    lockedCrushes: updatedLockedCrushes,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                operationCount++;
                updatedUsersCount++;

                if (operationCount === batchSize) {
                    batches.push(currentBatch);
                    currentBatch = db.batch();
                    operationCount = 0;
                }
            }
        }

        if (operationCount > 0) {
            batches.push(currentBatch);
        }

        // Execute all batches
        if (batches.length > 0) {
            console.log(`\n🔨 Executing ${batches.length} batches to update ${updatedUsersCount} users...`);
            await Promise.all(batches.map(batch => batch.commit()));
            console.log('✅ Successfully updated all user crush lists');
        } else {
            console.log('ℹ️ No user updates needed');
        }

        // Now recalculate crush counts and matches
        console.log('\n🔄 Recalculating crush counts and matches...');

        // Calculate new crush counts
        const newCrushCounts = new Map();
        for (const user of allUsers) {
            const currentName = user.verifiedName || user.displayName;
            if (currentName) {
                newCrushCounts.set(currentName, 0);
            }
        }

        // Get updated crushes from database
        const updatedUsersSnapshot = await db.collection('users').get();
        const updatedUsers = [];
        updatedUsersSnapshot.forEach(doc => {
            updatedUsers.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Count crushes based on updated data
        for (const user of updatedUsers) {
            const userCrushes = user.crushes || [];
            for (const crushName of userCrushes) {
                if (newCrushCounts.has(crushName)) {
                    newCrushCounts.set(crushName, newCrushCounts.get(crushName) + 1);
                }
            }
        }

        // Calculate matches
        const allMatches = new Map();
        const allLockedCrushes = new Map();
        let totalMatchPairs = 0;

        for (const user of updatedUsers) {
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
                // Find the user with this name
                const crushedUser = updatedUsers.find(u => {
                    const targetName = u.verifiedName || u.displayName;
                    return targetName && normalizeName(targetName) === normalizeName(crushName);
                });

                if (!crushedUser) continue;

                const crushedUserCrushes = crushedUser.crushes || [];
                const crushedUserIdentityName = crushedUser.verifiedName || crushedUser.displayName;

                // Check if it's a mutual match
                const hasMutualCrush = crushedUserCrushes.some(crush => {
                    return normalizeName(crush) === normalizeName(userIdentityName);
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

        // Update all users with new counts and matches
        const finalBatches = [];
        let finalCurrentBatch = db.batch();
        let finalOperationCount = 0;

        for (const user of updatedUsers) {
            const userRef = db.collection('users').doc(user.id);
            const userIdentityName = user.verifiedName || user.displayName;
            const updateData = {
                matches: allMatches.get(user.id) || [],
                lockedCrushes: allLockedCrushes.get(user.id) || [],
                crushCount: newCrushCounts.get(userIdentityName) || 0,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            finalCurrentBatch.update(userRef, updateData);
            finalOperationCount++;

            if (finalOperationCount === batchSize) {
                finalBatches.push(finalCurrentBatch);
                finalCurrentBatch = db.batch();
                finalOperationCount = 0;
            }
        }

        if (finalOperationCount > 0) {
            finalBatches.push(finalCurrentBatch);
        }

        // Execute final batches
        console.log(`🔨 Executing ${finalBatches.length} final batches...`);
        await Promise.all(finalBatches.map(batch => batch.commit()));

        console.log(`\n✅ Orphaned crush names cleanup completed successfully!`);
        console.log(`📊 Final Statistics:`);
        console.log(`   Users updated: ${updatedUsersCount}`);
        console.log(`   Orphaned names fixed: ${mappingStats.mapped}`);
        console.log(`   Total match instances: ${totalMatchPairs}`);

        // Show crush count changes
        console.log('\n🎯 Updated crush counts:');
        for (const [name, count] of newCrushCounts) {
            if (count > 0) {
                console.log(`   ${name}: ${count} crushes`);
            }
        }

    } catch (error) {
        console.error('❌ Error in fixOrphanedCrushNames:', error);
    }
}

fixOrphanedCrushNames();