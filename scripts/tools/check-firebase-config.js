import { readFileSync, existsSync } from 'fs';

console.log('='.repeat(80));
console.log('FIREBASE CONFIGURATION CHECK');
console.log('='.repeat(80));

// Check .firebaserc
if (existsSync('../../.firebaserc')) {
    console.log('\n📄 .firebaserc contents:');
    const firebaserc = readFileSync('../../.firebaserc', 'utf8');
    console.log(firebaserc);
} else {
    console.log('\n❌ .firebaserc not found');
}

// Check firebase.json
if (existsSync('../../firebase.json')) {
    console.log('\n📄 firebase.json contents:');
    const firebaseJson = readFileSync('../../firebase.json', 'utf8');
    console.log(firebaseJson);
} else {
    console.log('\n❌ firebase.json not found');
}

// Check if there's a vercel.json that might be conflicting
if (existsSync('../../vercel.json')) {
    console.log('\n📄 vercel.json contents:');
    const vercelJson = readFileSync('../../vercel.json', 'utf8');
    console.log(vercelJson);
} else {
    console.log('\n✅ No vercel.json found (good)');
}

console.log('\n' + '='.repeat(80));