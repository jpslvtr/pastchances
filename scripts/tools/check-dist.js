import { readdirSync, statSync } from 'fs';
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
console.log('CHECKING DIST FOLDER CONTENTS');
console.log('='.repeat(80));

checkDirectory('../../dist');

console.log('\n' + '='.repeat(80));
console.log('CHECKING PUBLIC FOLDER CONTENTS');
console.log('='.repeat(80));

checkDirectory('../../public');