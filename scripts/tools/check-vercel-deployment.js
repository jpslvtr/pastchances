import { readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

function checkDirectory(dirPath, prefix = '') {
    try {
        const items = readdirSync(dirPath);

        items.forEach(item => {
            const fullPath = join(dirPath, item);
            const stats = statSync(fullPath);

            if (stats.isDirectory()) {
                console.log(`${prefix}📁 ${item}/`);
                checkDirectory(fullPath, prefix + '  ');
            } else {
                const sizeKB = (stats.size / 1024).toFixed(1);
                console.log(`${prefix}📄 ${item} (${sizeKB} KB)`);
            }
        });
    } catch (error) {
        console.log(`${prefix}❌ Error reading directory: ${error.message}`);
    }
}

console.log('='.repeat(80));
console.log('VERCEL DEPLOYMENT CHECK');
console.log('='.repeat(80));

console.log('\n📁 DIST FOLDER CONTENTS:');
if (existsSync('../../dist')) {
    checkDirectory('../../dist');
} else {
    console.log('❌ dist folder does not exist!');
}

console.log('\n📁 PUBLIC FOLDER CONTENTS:');
if (existsSync('../../public')) {
    checkDirectory('../../public');
} else {
    console.log('❌ public folder does not exist!');
}

// Check if critical images exist
const criticalImages = [
    '../../dist/stanford.png',
    '../../dist/stanford.svg',
    '../../dist/share.png',
    '../../public/stanford.png',
    '../../public/stanford.svg',
    '../../public/share.png'
];

console.log('\n🔍 CRITICAL IMAGE CHECK:');
criticalImages.forEach(imagePath => {
    const exists = existsSync(imagePath);
    const status = exists ? '✅' : '❌';
    console.log(`   ${status} ${imagePath}`);

    if (exists) {
        const stats = statSync(imagePath);
        console.log(`      Size: ${(stats.size / 1024).toFixed(1)} KB`);
    }
});