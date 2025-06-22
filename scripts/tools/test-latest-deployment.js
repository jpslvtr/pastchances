import fetch from 'node-fetch';

async function testLatestDeployment() {
    console.log('='.repeat(80));
    console.log('TESTING LATEST VERCEL DEPLOYMENT');
    console.log('='.repeat(80));

    // Test the latest deployment URL directly
    const latestUrl = 'https://stanford-lastchances-g2pjyj8lp-jpslvtrs-projects.vercel.app';

    const images = ['/stanford.png', '/stanford.svg', '/share.png'];

    console.log(`\n🔍 Testing images on latest deployment: ${latestUrl}`);

    for (const imagePath of images) {
        const imageUrl = `${latestUrl}${imagePath}`;
        try {
            const response = await fetch(imageUrl);
            console.log(`   ${imagePath}: ${response.status} (${response.headers.get('content-type')})`);
        } catch (error) {
            console.log(`   ${imagePath}: ERROR - ${error.message}`);
        }
    }

    // Compare with your custom domain
    console.log(`\n🔍 Testing images on custom domain: https://pastchances.com`);

    for (const imagePath of images) {
        const imageUrl = `https://pastchances.com${imagePath}`;
        try {
            const response = await fetch(imageUrl);
            console.log(`   ${imagePath}: ${response.status} (${response.headers.get('content-type')})`);
        } catch (error) {
            console.log(`   ${imagePath}: ERROR - ${error.message}`);
        }
    }
}

testLatestDeployment();