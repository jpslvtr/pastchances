// scripts/firebase-queries/user-all.cjs

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
const outputPath = path.join(__dirname, 'user-all.txt');

// Create write stream that overwrites the file each run
const out = fs.createWriteStream(outputPath, { flags: 'w' });

function write(line) {
    out.write(line + '\n');
}

function header(title) {
    write('');
    write('=== ' + title + ' ===');
}

function formatDate(ts) {
    if (!ts) return 'N/A';
    if (ts.toDate) return ts.toDate().toISOString();
    return String(ts);
}

async function listUsers() {
    header('GSB users by lastLogin (desc)');

    const snap = await db
        .collection('users')
        .where('userClass', '==', 'gsb')
        .get();

    const docs = [];
    snap.forEach(doc => {
        docs.push({ id: doc.id, ...doc.data() });
    });

    docs.sort((a, b) => {
        const aDate = a.lastLogin?.toDate?.() ?? new Date(0);
        const bDate = b.lastLogin?.toDate?.() ?? new Date(0);
        return bDate - aDate;
    });

    write(`Found ${docs.length} users\n`);

    write(
        [
            'name'.padEnd(25),
            'email'.padEnd(30),
            'emailAlumni'.padEnd(30),
            'emailAlumniGSB'.padEnd(30),
            'lastLogin'.padEnd(25),
        ].join('  ')
    );

    write('-'.repeat(25 + 30 + 30 + 30 + 25 + 10));

    for (const u of docs) {
        const name = (u.name || '').toString();
        const email = (u.email || '').toString();
        const emailAlumni = (u.emailAlumni || '').toString();
        const emailAlumniGSB = (u.emailAlumniGSB || '').toString();
        const lastLoginStr = formatDate(u.lastLogin);

        write(
            [
                name.slice(0, 25).padEnd(25),
                email.slice(0, 30).padEnd(30),
                emailAlumni.slice(0, 30).padEnd(30),
                emailAlumniGSB.slice(0, 30).padEnd(30),
                lastLoginStr.slice(0, 25).padEnd(25),
            ].join('  ')
        );
    }
}

async function main() {
    try {
        await listUsers();
    } catch (err) {
        console.error('Error listing users:', err);
    } finally {
        out.end();
    }
}

main();
