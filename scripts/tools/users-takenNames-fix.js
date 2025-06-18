import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

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

// Dynamic import to load the TypeScript file
let GSB_CLASS_NAMES;
try {
    // Try to import the TS file directly (works with some Node.js setups)
    const namesModule = await import('../../src/data/names.ts');
    GSB_CLASS_NAMES = namesModule.GSB_CLASS_NAMES;
} catch (error) {
    // Fallback: read and eval the file content
    console.log('Direct TS import failed, trying file read approach...');
    try {
        const namesContent = readFileSync(join(__dirname, '../../src/data/names.ts'), 'utf8');
        // Extract the array from the TypeScript file
        const arrayMatch = namesContent.match(/export\s+const\s+GSB_CLASS_NAMES\s*=\s*(\[[\s\S]*?\]);/);
        if (arrayMatch) {
            GSB_CLASS_NAMES = eval(arrayMatch[1]);
        } else {
            throw new Error('Could not parse GSB_CLASS_NAMES from names.ts');
        }
    } catch (fileError) {
        console.error('Failed to load names from names.ts:', fileError);
        console.log('Please ensure src/data/names.ts exists and exports GSB_CLASS_NAMES');
        process.exit(1);
    }
}

// Helper function to normalize names for matching
function normalizeName(name) {
    if (!name || typeof name !== 'string') return '';
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Function to find best match in class names list
function findMatchingClassName(displayName, availableNames) {
    if (!displayName || !displayName.trim()) return null;

    const normalizedDisplay = normalizeName(displayName);

    // Try exact match first
    let match = availableNames.find(name =>
        normalizeName(name) === normalizedDisplay
    );

    if (match) return match;

    // Try partial match (first and last name only)
    const displayParts = normalizedDisplay.split(' ');
    if (displayParts.length >= 2) {
        const displayFirstLast = `${displayParts[0]} ${displayParts[displayParts.length - 1]}`;

        match = availableNames.find(name => {
            const nameParts = normalizeName(name).split(' ');
            if (nameParts.length >= 2) {
                const nameFirstLast = `${nameParts[0]} ${nameParts[nameParts.length - 1]}`;
                return nameFirstLast === displayFirstLast;
            }
            return false;
        });
    }

    return match || null;
}

// Enhanced function to find user by name (similar to backend logic)
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

    // Try partial match (first and last name only)
    const crushParts = normalizedCrush.split(' ');
    if (crushParts.length >= 2) {
        const crushFirstLast = `${crushParts[0]} ${crushParts[crushParts.length - 1]}`;

        // Try partial match with verifiedName
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

        // Try partial match with displayName
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

async function comprehensiveFix() {
    try {
        console.log('🔧 Starting comprehensive fix for users/takenNames discrepancies...\n');
        console.log(`📋 Loaded ${GSB_CLASS_NAMES.length} names from class list\n`);

        // Get all data
        const usersSnapshot = await db.collection('users').get();
        const takenNamesSnapshot = await db.collection('takenNames').get();

        console.log(`Initial counts - Users: ${usersSnapshot.size}, TakenNames: ${takenNamesSnapshot.size}`);
        console.log(`Initial discrepancy: ${usersSnapshot.size - takenNamesSnapshot.size}\n`);

        // Build data structures
        const allUsers = new Map();
        const takenNamesMap = new Map();
        const takenByUidMap = new Map();

        // Process users
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            allUsers.set(doc.id, {
                uid: doc.id,
                email: userData.email,
                displayName: userData.displayName,
                verifiedName: userData.verifiedName,
                crushes: userData.crushes || [],
                lockedCrushes: userData.lockedCrushes || [],
                matches: userData.matches || [],
                crushCount: userData.crushCount || 0
            });
        });

        // Process takenNames
        takenNamesSnapshot.forEach(doc => {
            const data = doc.data();
            const nameId = doc.id;
            takenNamesMap.set(nameId, {
                takenBy: data.takenBy,
                email: data.email,
                takenAt: data.takenAt
            });
            takenByUidMap.set(data.takenBy, nameId);
        });

        // ISSUE 1: Users without verifiedName - NOW WITH AUTO-FIX
        console.log('1️⃣ Checking users without verifiedName...');
        const usersWithoutVerifiedName = [];
        for (const [uid, user] of allUsers) {
            if (!user.verifiedName || user.verifiedName.trim() === '') {
                usersWithoutVerifiedName.push(user);
            }
        }
        console.log(`   Found ${usersWithoutVerifiedName.length} users without verifiedName`);

        // Auto-fix users without verifiedName by matching displayName to class list
        const autoFixedUsers = [];
        if (usersWithoutVerifiedName.length > 0 && GSB_CLASS_NAMES.length > 0) {
            console.log('   Attempting to auto-fix by matching displayNames to class list...');

            // Get currently available names (not taken)
            const takenNames = new Set(takenNamesMap.keys());
            const availableNames = GSB_CLASS_NAMES.filter(name => !takenNames.has(name));

            console.log(`   Available names for auto-assignment: ${availableNames.length}`);

            const batch0 = db.batch();

            for (const user of usersWithoutVerifiedName) {
                const matchedName = findMatchingClassName(user.displayName, availableNames);

                if (matchedName) {
                    console.log(`   - Auto-fixing: "${user.displayName}" -> "${matchedName}" (${user.email})`);

                    // Update user document
                    const userRef = db.collection('users').doc(user.uid);
                    batch0.update(userRef, {
                        verifiedName: matchedName,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        autoFixed: true,
                        autoFixedAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    // Create takenName document
                    const takenNameRef = db.collection('takenNames').doc(matchedName);
                    batch0.set(takenNameRef, {
                        takenBy: user.uid,
                        takenAt: admin.firestore.FieldValue.serverTimestamp(),
                        email: user.email,
                        autoAssigned: true
                    });

                    autoFixedUsers.push({ user, matchedName });

                    // Update local data structure
                    user.verifiedName = matchedName;
                    allUsers.set(user.uid, user);

                    // Remove from available names so it's not assigned twice
                    const index = availableNames.indexOf(matchedName);
                    if (index > -1) {
                        availableNames.splice(index, 1);
                    }
                } else {
                    console.log(`   - No match found for: "${user.displayName}" (${user.email})`);
                }
            }

            if (autoFixedUsers.length > 0) {
                await batch0.commit();
                console.log(`   ✅ Auto-fixed ${autoFixedUsers.length} users by matching displayName to class list`);
            }
        }

        // Log remaining users that couldn't be auto-fixed
        const remainingUnfixed = usersWithoutVerifiedName.filter(user =>
            !autoFixedUsers.some(fixed => fixed.user.uid === user.uid)
        );

        if (remainingUnfixed.length > 0) {
            console.log(`   Remaining users without verifiedName (couldn't auto-fix):`);
            remainingUnfixed.forEach(user => {
                console.log(`   - ${user.email} (displayName: "${user.displayName}") (${user.uid})`);
            });
        }

        // ISSUE 2: Users with verifiedName but no takenName document
        console.log('\n2️⃣ Checking users missing takenName documents...');

        // Refresh data after auto-fixes
        const updatedUsersSnapshot = await db.collection('users').get();
        const updatedTakenNamesSnapshot = await db.collection('takenNames').get();

        // Rebuild maps with fresh data
        allUsers.clear();
        takenNamesMap.clear();

        updatedUsersSnapshot.forEach(doc => {
            const userData = doc.data();
            allUsers.set(doc.id, {
                uid: doc.id,
                email: userData.email,
                displayName: userData.displayName,
                verifiedName: userData.verifiedName,
                crushes: userData.crushes || [],
                lockedCrushes: userData.lockedCrushes || [],
                matches: userData.matches || [],
                crushCount: userData.crushCount || 0
            });
        });

        updatedTakenNamesSnapshot.forEach(doc => {
            const data = doc.data();
            const nameId = doc.id;
            takenNamesMap.set(nameId, {
                takenBy: data.takenBy,
                email: data.email,
                takenAt: data.takenAt
            });
        });

        const usersMissingTakenNames = [];
        for (const [uid, user] of allUsers) {
            if (user.verifiedName && user.verifiedName.trim() !== '') {
                if (!takenNamesMap.has(user.verifiedName)) {
                    usersMissingTakenNames.push(user);
                }
            }
        }
        console.log(`   Found ${usersMissingTakenNames.length} users missing takenName documents`);

        // Create missing takenName documents
        if (usersMissingTakenNames.length > 0) {
            console.log('   Creating missing takenName documents...');
            const batch1 = db.batch();

            usersMissingTakenNames.forEach(user => {
                console.log(`   - Creating takenName for "${user.verifiedName}" -> ${user.email}`);
                const takenNameRef = db.collection('takenNames').doc(user.verifiedName);
                batch1.set(takenNameRef, {
                    takenBy: user.uid,
                    takenAt: admin.firestore.FieldValue.serverTimestamp(),
                    email: user.email
                });
            });

            await batch1.commit();
            console.log(`   ✅ Created ${usersMissingTakenNames.length} missing takenName documents`);
        }

        // ISSUE 3: TakenNames pointing to wrong UIDs
        console.log('\n3️⃣ Checking takenNames with wrong UID pointers...');
        const wrongUidPointers = [];
        for (const [uid, user] of allUsers) {
            if (user.verifiedName && user.verifiedName.trim() !== '') {
                const takenNameInfo = takenNamesMap.get(user.verifiedName);
                if (takenNameInfo && takenNameInfo.takenBy !== uid) {
                    wrongUidPointers.push({
                        user: user,
                        takenNameInfo: takenNameInfo,
                        correctUid: uid,
                        wrongUid: takenNameInfo.takenBy
                    });
                }
            }
        }
        console.log(`   Found ${wrongUidPointers.length} takenNames with wrong UID pointers`);

        // Fix wrong UID pointers
        if (wrongUidPointers.length > 0) {
            console.log('   Fixing wrong UID pointers...');
            const batch2 = db.batch();

            wrongUidPointers.forEach(({ user, takenNameInfo, correctUid, wrongUid }) => {
                console.log(`   - Fixing "${user.verifiedName}": ${wrongUid} -> ${correctUid} (${user.email})`);
                const takenNameRef = db.collection('takenNames').doc(user.verifiedName);
                batch2.update(takenNameRef, {
                    takenBy: correctUid,
                    email: user.email,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    previousTakenBy: wrongUid,
                    fixedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });

            await batch2.commit();
            console.log(`   ✅ Fixed ${wrongUidPointers.length} wrong UID pointers`);
        }

        // ISSUE 4: Duplicate verifiedNames (multiple users with same name)
        console.log('\n4️⃣ Checking for duplicate verifiedNames...');
        const verifiedNameCounts = new Map();
        for (const [uid, user] of allUsers) {
            if (user.verifiedName && user.verifiedName.trim() !== '') {
                if (!verifiedNameCounts.has(user.verifiedName)) {
                    verifiedNameCounts.set(user.verifiedName, []);
                }
                verifiedNameCounts.get(user.verifiedName).push(user);
            }
        }

        const duplicateNames = [];
        for (const [name, users] of verifiedNameCounts) {
            if (users.length > 1) {
                duplicateNames.push({ name, users });
            }
        }

        if (duplicateNames.length > 0) {
            console.log(`   Found ${duplicateNames.length} names with multiple users:`);
            duplicateNames.forEach(({ name, users }) => {
                console.log(`   - "${name}" claimed by:`);
                users.forEach(user => {
                    console.log(`     * ${user.email} (${user.uid})`);
                });
                console.log(`   ⚠️  MANUAL INTERVENTION REQUIRED: Determine which user should keep this name`);
            });
        } else {
            console.log('   ✅ No duplicate verifiedNames found');
        }

        // ISSUE 5: Orphaned takenNames (pointing to non-existent users)
        console.log('\n5️⃣ Checking for orphaned takenNames...');
        const orphanedTakenNames = [];
        for (const [name, takenNameInfo] of takenNamesMap) {
            if (!allUsers.has(takenNameInfo.takenBy)) {
                orphanedTakenNames.push({ name, takenNameInfo });
            }
        }

        if (orphanedTakenNames.length > 0) {
            console.log(`   Found ${orphanedTakenNames.length} orphaned takenNames:`);
            console.log('   Removing orphaned takenNames...');

            const batch3 = db.batch();
            orphanedTakenNames.forEach(({ name, takenNameInfo }) => {
                console.log(`   - Removing "${name}" (pointed to non-existent user ${takenNameInfo.takenBy})`);
                const takenNameRef = db.collection('takenNames').doc(name);
                batch3.delete(takenNameRef);
            });

            await batch3.commit();
            console.log(`   ✅ Removed ${orphanedTakenNames.length} orphaned takenNames`);
        } else {
            console.log('   ✅ No orphaned takenNames found');
        }

        // ISSUE 6: Users with multiple takenNames
        console.log('\n6️⃣ Checking for users with multiple takenNames...');
        const uidCounts = new Map();
        for (const [name, takenNameInfo] of takenNamesMap) {
            const uid = takenNameInfo.takenBy;
            if (!uidCounts.has(uid)) {
                uidCounts.set(uid, []);
            }
            uidCounts.get(uid).push(name);
        }

        const usersWithMultipleTakenNames = [];
        for (const [uid, names] of uidCounts) {
            if (names.length > 1) {
                const user = allUsers.get(uid);
                usersWithMultipleTakenNames.push({ user, names });
            }
        }

        if (usersWithMultipleTakenNames.length > 0) {
            console.log(`   Found ${usersWithMultipleTakenNames.length} users with multiple takenNames:`);

            const batch4 = db.batch();
            usersWithMultipleTakenNames.forEach(({ user, names }) => {
                console.log(`   - ${user.email} has takenNames: ${names.join(', ')}`);
                console.log(`     Current verifiedName: "${user.verifiedName}"`);

                // Keep only the takenName that matches current verifiedName, remove others
                names.forEach(name => {
                    if (name !== user.verifiedName) {
                        console.log(`     Removing extra takenName: "${name}"`);
                        const takenNameRef = db.collection('takenNames').doc(name);
                        batch4.delete(takenNameRef);
                    }
                });
            });

            await batch4.commit();
            console.log(`   ✅ Cleaned up multiple takenNames`);
        } else {
            console.log('   ✅ No users with multiple takenNames found');
        }

        // NEW ISSUE 7: Orphaned Crushes (crushes pointing to people who signed up later)
        console.log('\n7️⃣ Checking for orphaned crushes and fixing historical crush counts...');

        // Convert allUsers Map to Array for easier processing
        const allUsersArray = Array.from(allUsers.values());

        // Find all unique crush names across all users
        const allCrushNames = new Set();
        allUsersArray.forEach(user => {
            const userCrushes = user.crushes || [];
            userCrushes.forEach(crushName => {
                allCrushNames.add(crushName);
            });
        });

        console.log(`   Found ${allCrushNames.size} unique crush names across all users`);

        // Check which crush names don't have corresponding users
        const orphanedCrushNames = [];
        const matchedCrushNames = [];

        allCrushNames.forEach(crushName => {
            const matchedUser = findUserByName(crushName, allUsersArray);
            if (matchedUser) {
                matchedCrushNames.push({
                    crushName,
                    matchedUser: matchedUser.verifiedName || matchedUser.displayName,
                    uid: matchedUser.uid
                });
            } else {
                orphanedCrushNames.push(crushName);
            }
        });

        console.log(`   - ${matchedCrushNames.length} crush names have corresponding users`);
        console.log(`   - ${orphanedCrushNames.length} crush names are orphaned (no user found)`);

        if (orphanedCrushNames.length > 0) {
            console.log('   Orphaned crush names:');
            orphanedCrushNames.forEach(name => {
                console.log(`     * "${name}"`);
            });
        }

        // Recalculate crush counts properly
        console.log('\n   Recalculating crush counts with enhanced matching...');
        const crushCounts = new Map();

        allUsersArray.forEach(user => {
            const userCrushes = user.crushes || [];
            userCrushes.forEach(crushName => {
                const targetUser = findUserByName(crushName, allUsersArray);

                if (targetUser) {
                    // Found a matching user - count under their actual identity
                    const actualName = targetUser.verifiedName || targetUser.displayName;
                    if (actualName) {
                        crushCounts.set(actualName, (crushCounts.get(actualName) || 0) + 1);
                        crushCounts.set(targetUser.uid, (crushCounts.get(targetUser.uid) || 0) + 1);
                    }
                } else {
                    // No user found - this is an orphaned crush
                    crushCounts.set(crushName, (crushCounts.get(crushName) || 0) + 1);
                }
            });
        });

        // Update users with corrected crush counts
        const usersNeedingCrushCountUpdate = [];
        allUsersArray.forEach(user => {
            const userIdentityName = user.verifiedName || user.displayName;
            let correctCrushCount = 0;

            if (userIdentityName) {
                correctCrushCount = crushCounts.get(userIdentityName) || 0;

                // Also check UID-based count (in case of name mismatches)
                const uidCount = crushCounts.get(user.uid) || 0;
                correctCrushCount = Math.max(correctCrushCount, uidCount);
            }

            if (user.crushCount !== correctCrushCount) {
                usersNeedingCrushCountUpdate.push({
                    uid: user.uid,
                    email: user.email,
                    name: userIdentityName,
                    oldCount: user.crushCount,
                    newCount: correctCrushCount
                });
            }
        });

        if (usersNeedingCrushCountUpdate.length > 0) {
            console.log(`   Found ${usersNeedingCrushCountUpdate.length} users with incorrect crush counts:`);

            const batch5 = db.batch();
            usersNeedingCrushCountUpdate.forEach(({ uid, email, name, oldCount, newCount }) => {
                console.log(`   - ${name} (${email}): ${oldCount} -> ${newCount} crushes`);
                const userRef = db.collection('users').doc(uid);
                batch5.update(userRef, {
                    crushCount: newCount,
                    crushCountFixedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });

            await batch5.commit();
            console.log(`   ✅ Updated crush counts for ${usersNeedingCrushCountUpdate.length} users`);
        } else {
            console.log('   ✅ All crush counts are already correct');
        }

        // Final verification
        console.log('\n🔍 Final verification...');
        const finalUsersSnapshot = await db.collection('users').get();
        const finalTakenNamesSnapshot = await db.collection('takenNames').get();

        console.log(`Final counts - Users: ${finalUsersSnapshot.size}, TakenNames: ${finalTakenNamesSnapshot.size}`);
        console.log(`Final discrepancy: ${finalUsersSnapshot.size - finalTakenNamesSnapshot.size}`);

        // Calculate expected discrepancy (users without verifiedName after all fixes)
        let finalUsersWithoutVerifiedName = 0;
        finalUsersSnapshot.forEach(doc => {
            const userData = doc.data();
            if (!userData.verifiedName || userData.verifiedName.trim() === '') {
                finalUsersWithoutVerifiedName++;
            }
        });

        const actualDiscrepancy = finalUsersSnapshot.size - finalTakenNamesSnapshot.size;

        if (actualDiscrepancy === finalUsersWithoutVerifiedName) {
            console.log(`✅ SUCCESS! Discrepancy matches expected value (${finalUsersWithoutVerifiedName} users without verifiedName)`);
        } else {
            console.log(`⚠️  Unexpected discrepancy: Expected ${finalUsersWithoutVerifiedName}, Got ${actualDiscrepancy}`);
        }

        console.log('\n📊 SUMMARY:');
        console.log(`   Users auto-fixed by displayName matching: ${autoFixedUsers.length}`);
        console.log(`   Users still without verifiedName: ${finalUsersWithoutVerifiedName} (expected)`);
        console.log(`   Missing takenNames created: ${usersMissingTakenNames.length}`);
        console.log(`   Wrong UID pointers fixed: ${wrongUidPointers.length}`);
        console.log(`   Duplicate names found: ${duplicateNames.length} (manual intervention needed)`);
        console.log(`   Orphaned takenNames removed: ${orphanedTakenNames.length}`);
        console.log(`   Multiple takenNames cleaned: ${usersWithMultipleTakenNames.length}`);
        console.log(`   Orphaned crush names found: ${orphanedCrushNames.length}`);
        console.log(`   Users with corrected crush counts: ${usersNeedingCrushCountUpdate.length}`);

        if (duplicateNames.length > 0) {
            console.log('\n⚠️  MANUAL ACTION REQUIRED:');
            console.log('   Some users have selected the same verifiedName.');
            console.log('   You need to manually determine which user should keep each name');
            console.log('   and clear the verifiedName for the others so they can re-select.');
        }

        if (autoFixedUsers.length > 0) {
            console.log('\n✅ AUTO-FIXED USERS:');
            autoFixedUsers.forEach(({ user, matchedName }) => {
                console.log(`   "${user.displayName}" -> "${matchedName}" (${user.email})`);
            });
        }

        if (orphanedCrushNames.length > 0) {
            console.log('\n⚠️  ORPHANED CRUSHES:');
            console.log('   The following names have crushes but no corresponding users:');
            orphanedCrushNames.forEach(name => {
                const count = crushCounts.get(name) || 0;
                console.log(`   - "${name}" (${count} crushes)`);
            });
            console.log('   These will automatically resolve when those people sign up and verify their names.');
        }

        console.log('\n🎉 Comprehensive fix completed!');

    } catch (error) {
        console.error('❌ Error in comprehensive fix:', error);
    }
}

comprehensiveFix();