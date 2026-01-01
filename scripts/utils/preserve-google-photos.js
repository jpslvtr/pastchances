// One-time script to preserve real Google photos by copying photoURL to customPhotoURL
// Run this once: node scripts/utils/preserve-google-photos.js

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

const USERS_TO_PRESERVE = [
    'Krupa Adusumilli',
    'Naza Aibar',
    'SimoneTess Aisiks',
    'Khalid Alajlan',
    'Mubarak Alliyu',
    'Sonja Anton',
    'Pedro Benoit',
    'Anya Bharadwaj',
    'Ryan Davis',
    'Ian De Luna',
    'Nico deLuna',
    'Omer Doron',
    'Hob Du',
    'Fatma Elshenawy',
    'Noelle Eveland',
    'Sofia Figueroa',
    'Pablo Golac',
    'Zhi Huang',
    'Akshita Jain',
    'Imren Johar',
    'Sakshi Khanna',
    'Laura Vanessa Kiehl',
    'Brendan Kim',
    'Bruno Koba',
    'Conor Leen',
    'Michael Liu',
    'Ndirangu (Bryan) Maina',
    'Mehek Mohan',
    'Munim Moiz',
    'Yoshimi Muneta',
    'Carson Muscat',
    'Karn Nahata',
    'Joan Nolla Suárez',
    'Kiera Peltz',
    'Vasundhara Rakesh',
    'James Ramsay',
    'Pragati Rastogi',
    'Aislin Roth',
    'Saman Siddiqui',
    'Shikhar Sood',
    'Jessica Garcia',
    'Mahek Vara',
    'Agustin Villarreal',
    'Talha Yousaf',
    'Theresa Yu',
    'James Park'
];

async function preserveGooglePhotos() {
    console.log('🔄 Starting to preserve Google photos for real photo users...\n');

    let successCount = 0;
    let alreadyHasCustom = 0;
    let noPhotoUrl = 0;
    let notFound = 0;

    for (const name of USERS_TO_PRESERVE) {
        try {
            // Find user by name
            const usersRef = db.collection('users');
            const snapshot = await usersRef
                .where('name', '==', name)
                .where('userClass', '==', 'gsb')
                .get();

            if (snapshot.empty) {
                console.log(`❌ User not found: ${name}`);
                notFound++;
                continue;
            }

            const userDoc = snapshot.docs[0];
            const userData = userDoc.data();

            // Skip if they already have a customPhotoURL
            if (userData.customPhotoURL) {
                console.log(`⏭️  ${name} already has customPhotoURL - skipping`);
                alreadyHasCustom++;
                continue;
            }

            // Skip if they don't have a photoURL
            if (!userData.photoURL) {
                console.log(`⚠️  ${name} has no photoURL - skipping`);
                noPhotoUrl++;
                continue;
            }

            // Copy photoURL to customPhotoURL
            await userDoc.ref.update({
                customPhotoURL: userData.photoURL,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`✅ ${name} - preserved Google photo`);
            successCount++;

        } catch (error) {
            console.error(`❌ Error processing ${name}:`, error.message);
        }
    }

    console.log('\n📊 Summary:');
    console.log(`✅ Successfully preserved: ${successCount}`);
    console.log(`⏭️  Already had customPhotoURL: ${alreadyHasCustom}`);
    console.log(`⚠️  No photoURL to preserve: ${noPhotoUrl}`);
    console.log(`❌ Not found in database: ${notFound}`);
    console.log(`📝 Total processed: ${USERS_TO_PRESERVE.length}`);

    process.exit(0);
}

preserveGooglePhotos().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});