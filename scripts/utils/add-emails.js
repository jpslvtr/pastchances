import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccount = JSON.parse(
    readFileSync(join(__dirname, '../../functions/src/serviceAccountKey.json'), 'utf8')
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'stanford-lastchances',
});

const db = admin.firestore();

function parseCSV(csvPath) {
    const content = readFileSync(csvPath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());

    // Skip header
    const dataLines = lines.slice(1);

    const emailMap = new Map();

    for (const line of dataLines) {
        // Split by comma, handling spaces after commas
        const parts = line.split(',').map(p => p.trim());

        if (parts.length >= 4) {
            const email = parts[1];
            const emailAlumni = parts[2];
            const emailAlumniGSB = parts[3];

            emailMap.set(email, {
                emailAlumni,
                emailAlumniGSB
            });
        }
    }

    return emailMap;
}

async function updateAlumniEmails() {
    console.log('Loading CSV data...');
    const csvPath = join(__dirname, '../../src/data/email_map/not-missing.csv');
    const emailMap = parseCSV(csvPath);

    console.log(`Loaded ${emailMap.size} alumni email records from CSV`);

    console.log('\nFetching all users...');
    const usersSnapshot = await db.collection('users').get();

    console.log(`Found ${usersSnapshot.size} total users in Firestore`);

    let updatedCount = 0;
    let skippedCount = 0;

    const batch = db.batch();
    let batchCount = 0;
    const BATCH_LIMIT = 500;

    for (const doc of usersSnapshot.docs) {
        const data = doc.data();
        const email = data.email;

        if (emailMap.has(email)) {
            const alumniData = emailMap.get(email);
            batch.update(doc.ref, {
                emailAlumni: alumniData.emailAlumni,
                emailAlumniGSB: alumniData.emailAlumniGSB
            });
            updatedCount++;
            console.log(`✓ ${data.name || 'No name'} (${email})`);
        } else {
            batch.update(doc.ref, {
                emailAlumni: '',
                emailAlumniGSB: ''
            });
            skippedCount++;
            console.log(`- ${data.name || 'No name'} (${email}) - no alumni emails found`);
        }

        batchCount++;

        // Commit batch if we hit the limit
        if (batchCount === BATCH_LIMIT) {
            console.log('\nCommitting batch...');
            await batch.commit();
            batchCount = 0;
        }
    }

    // Commit remaining updates
    if (batchCount > 0) {
        console.log('\nCommitting final batch...');
        await batch.commit();
    }

    console.log('\n=== Summary ===');
    console.log(`Total users processed: ${usersSnapshot.size}`);
    console.log(`Users with alumni emails: ${updatedCount}`);
    console.log(`Users without alumni emails: ${skippedCount}`);
    console.log('\nAll users updated successfully.');

    process.exit(0);
}

updateAlumniEmails().catch(err => {
    console.error('Error updating alumni emails:', err);
    process.exit(1);
});