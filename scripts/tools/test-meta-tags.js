import fetch from 'node-fetch';

async function testMetaTags() {
    const url = 'https://pastchances.com';

    try {
        const response = await fetch(url);
        const html = await response.text();

        console.log('='.repeat(80));
        console.log('META TAGS TEST');
        console.log('='.repeat(80));

        // Check for share.png
        const shareImageRegex = /<meta\s+property="og:image"\s+content="([^"]+)"/;
        const shareMatch = html.match(shareImageRegex);

        if (shareMatch) {
            console.log('✅ Found og:image meta tag:', shareMatch[1]);

            // Test if image is accessible
            try {
                const imgResponse = await fetch(shareMatch[1]);
                console.log('✅ Image accessible:', imgResponse.status === 200 ? 'YES' : 'NO');
                console.log('   Status:', imgResponse.status);
                console.log('   Content-Type:', imgResponse.headers.get('content-type'));
            } catch (error) {
                console.log('❌ Image not accessible:', error.message);
            }
        } else {
            console.log('❌ og:image meta tag not found');
        }

        // Check for favicon
        const faviconRegex = /<link\s+rel="icon"[^>]*href="([^"]+)"/g;
        let faviconMatch;
        console.log('\n📌 Favicon links found:');
        while ((faviconMatch = faviconRegex.exec(html)) !== null) {
            console.log('   -', faviconMatch[1]);
        }

        console.log('\n' + '='.repeat(80));

    } catch (error) {
        console.error('Error testing meta tags:', error);
    }
}

// Test with various social media debuggers
console.log('\n🔍 Test your meta tags with these tools:');
console.log('1. Facebook: https://developers.facebook.com/tools/debug/');
console.log('2. Twitter: https://cards-dev.twitter.com/validator');
console.log('3. LinkedIn: https://www.linkedin.com/post-inspector/');
console.log('4. General: https://metatags.io/');

testMetaTags();