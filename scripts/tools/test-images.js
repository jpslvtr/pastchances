import fetch from 'node-fetch';

async function testImages() {
    console.log('='.repeat(80));
    console.log('IMAGE AVAILABILITY TEST');
    console.log('='.repeat(80));

    const baseUrl = 'https://pastchances.com';
    const images = [
        '/stanford.png',
        '/stanford.svg',
        '/share.png'
    ];

    for (const imagePath of images) {
        const url = `${baseUrl}${imagePath}`;
        console.log(`\n🔍 Testing: ${url}`);

        try {
            const response = await fetch(url, {
                method: 'HEAD',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; LinkPreview/1.0)'
                }
            });

            console.log(`   Status: ${response.status}`);
            console.log(`   Content-Type: ${response.headers.get('content-type')}`);
            console.log(`   Content-Length: ${response.headers.get('content-length')}`);
            console.log(`   Cache-Control: ${response.headers.get('cache-control')}`);
            console.log(`   Access-Control-Allow-Origin: ${response.headers.get('access-control-allow-origin')}`);

            if (response.status === 200) {
                console.log(`   ✅ Available`);
            } else {
                console.log(`   ❌ Not available`);
            }
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('SOCIAL MEDIA TESTING TOOLS:');
    console.log('Facebook: https://developers.facebook.com/tools/debug/');
    console.log('Twitter: https://cards-dev.twitter.com/validator');
    console.log('LinkedIn: https://www.linkedin.com/post-inspector/');
    console.log('Open Graph: https://www.opengraph.xyz/');
    console.log('='.repeat(80));
}

testImages();