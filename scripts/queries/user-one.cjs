// scripts/firebase-queries/user-detail.cjs

// ---------------------------------------------------------
// EDIT THIS VALUE
// ---------------------------------------------------------
const TARGET_NAME = 'James Park'.toLowerCase();
// ---------------------------------------------------------

const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

// Resolve path to service account key
const serviceAccountPath = path.join(
    __dirname,
    '..',
    '..',
    'functions',
    'src',
    'serviceAccountKey.json'
);

const serviceAccount = require(serviceAccountPath);

// Initialize Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'stanford-lastchances',
});

const db = admin.firestore();

// Output file path
const outputPath = path.join(__dirname, 'user-one.txt');

// Create write stream that overwrites each run
const out = fs.createWriteStream(outputPath, { flags: 'w' });

function write(line = '') {
    out.write(line + '\n');
}

function header(title) {
    write('');
    write('=== ' + title + ' ===');
}

function pretty(obj) {
    return JSON.stringify(obj, null, 2);
}

function formatDate(ts) {
    if (!ts) return 'N/A';
    if (ts.toDate) return ts.toDate().toISOString();
    return String(ts);
}

async function showUser() {
    header(`User detail for name: "${TARGET_NAME}"`);

    const snap = await db
        .collection('users')
        .where('userClass', '==', 'gsb')
        .get();

    let foundDoc = null;

    snap.forEach(doc => {
        const data = doc.data();
        if (!data.name) return;

        if (data.name.toLowerCase() === TARGET_NAME) {
            foundDoc = { id: doc.id, data };
        }
    });

    if (!foundDoc) {
        write('No matching GSB user found.');
        return;
    }

    const { id, data } = foundDoc;

    const name = data.name || 'N/A';
    const email = data.email || 'N/A';
    const lastLogin = formatDate(data.lastLogin);
    const crushCount = data.crushCount ?? 0;

    const matches = Array.isArray(data.matches) ? data.matches : [];
    const matchCount = matches.length;

    write('');
    write('--- Summary ---');
    write('id          : ' + id);
    write('name        : ' + name);
    write('email       : ' + email);
    write('userClass   : ' + data.userClass);
    write('lastLogin   : ' + lastLogin);
    write('crushCount  : ' + crushCount);
    write('matchCount  : ' + matchCount);

    write('');
    write('--- Full document ---');
    write(pretty(data));
}

async function main() {
    try {
        await showUser();
    } catch (err) {
        console.error('Error fetching user:', err);
    } finally {
        out.end();
    }
}

main();
