import fetch from 'node-fetch';

async function detailedImageTest() {
    console.log('='.repeat(80));
    console.log('DETAILED IMAGE TEST');
    console.log('='.repeat(80));

    const baseUrl = 'https://pastchances.com';
    const images = ['/stanford.png', '/stanford.svg', '/share.png'];

    for (const imagePath of images) {
        const url = `${baseUrl}${imagePath}`;
        console.log(`\n🔍 Testing: ${url}`);

        try {
            // Get full response
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; LinkPreview/1.0)',
                    'Accept': 'image/*,*/*'
                }
            });

            console.log(`   Status: ${response.status}`);
            console.log(`   Content-Type: ${response.headers.get('content-type')}`);
            console.log(`   Content-Length: ${response.headers.get('content-length')}`);
            console.log(`   Cache-Control: ${response.headers.get('cache-control')}`);

            // Get first 200 characters of response to see what's being served
            const text = await response.text();
            console.log(`   First 200 chars: ${text.substring(0, 200)}`);

            // Check if it's actually HTML
            if (text.includes('<!doctype html') || text.includes('<html')) {
                console.log(`   ❌ This is HTML, not an image!`);
            } else {
                console.log(`   ✅ This appears to be binary/image data`);
            }

        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
    }
}

detailedImageTest();