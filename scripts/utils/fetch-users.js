import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
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

async function fetchUsers() {
    try {
        let output = '';

        // Get all users
        const usersSnapshot = await db.collection('users').get();

        const gsbUsers = [];
        usersSnapshot.forEach(doc => {
            const data = doc.data();

            // Only include GSB users
            if (data.userClass !== 'gsb') return;

            // Convert lastLogin to timestamp
            let lastLoginTimestamp = null;
            if (data.lastLogin) {
                if (data.lastLogin.toDate) {
                    lastLoginTimestamp = data.lastLogin.toDate().getTime();
                } else if (data.lastLogin.seconds) {
                    lastLoginTimestamp = data.lastLogin.seconds * 1000;
                }
            }

            gsbUsers.push({
                name: data.name || '',
                email: data.email || '',
                lastLogin: lastLoginTimestamp
            });
        });

        const totalGsbUsers = gsbUsers.length;
        output += `=== TOTAL GSB USERS: ${totalGsbUsers} ===\n\n`;
        output += JSON.stringify(gsbUsers, null, 2);

        // Write to file in project root
        writeFileSync(join(__dirname, '../../data.txt'), output, 'utf8');
        console.log(`✅ Exported ${totalGsbUsers} GSB users to data.txt`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        process.exit(0);
    }
}

fetchUsers();