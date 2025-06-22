import fetch from 'node-fetch';

async function testFaviconAndMeta() {
    console.log('='.repeat(80));
    console.log('FAVICON AND META TAGS TEST');
    console.log('='.repeat(80));

    const url = 'https://pastchances.com';

    try {
        console.log('\n🔍 Testing main page HTML:');
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });

        const html = await response.text();

        // Check for favicon links
        console.log('\n📄 FAVICON LINKS FOUND:');
        const faviconRegex = /<link[^>]*rel=[^>]*icon[^>]*>/gi;
        const faviconMatches = html.match(faviconRegex) || [];
        faviconMatches.forEach((match, index) => {
            console.log(`   ${index + 1}. ${match}`);
        });

        // Check for Open Graph meta tags
        console.log('\n📄 OPEN GRAPH META TAGS:');
        const ogTags = [
            'og:title', 'og:description', 'og:image', 'og:url', 'og:type'
        ];

        ogTags.forEach(tag => {
            const regex = new RegExp(`<meta\\s+property="${tag}"\\s+content="([^"]+)"`, 'i');
            const match = html.match(regex);
            console.log(`   ${tag}: ${match ? match[1] : 'NOT FOUND'}`);
        });

        // Check for Twitter meta tags
        console.log('\n📄 TWITTER META TAGS:');
        const twitterTags = [
            'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'
        ];

        twitterTags.forEach(tag => {
            const regex = new RegExp(`<meta\\s+name="${tag}"\\s+content="([^"]+)"`, 'i');
            const match = html.match(regex);
            console.log(`   ${tag}: ${match ? match[1] : 'NOT FOUND'}`);
        });

        // Test specific favicon URLs with cache busting
        console.log('\n🔍 Testing favicon URLs with cache busting:');
        const faviconUrls = [
            '/stanford.png?v=3',
            '/stanford.svg?v=3',
            '/stanford.png',
            '/stanford.svg'
        ];

        for (const faviconPath of faviconUrls) {
            const faviconUrl = `https://pastchances.com${faviconPath}`;
            try {
                const faviconResponse = await fetch(faviconUrl, {
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                });
                console.log(`   ${faviconPath}: ${faviconResponse.status} (${faviconResponse.headers.get('content-type')})`);
            } catch (error) {
                console.log(`   ${faviconPath}: ERROR - ${error.message}`);
            }
        }

        // Test share.png specifically
        console.log('\n🔍 Testing share.png:');
        const shareResponse = await fetch('https://pastchances.com/share.png?v=3', {
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        console.log(`   Status: ${shareResponse.status}`);
        console.log(`   Content-Type: ${shareResponse.headers.get('content-type')}`);
        console.log(`   Content-Length: ${shareResponse.headers.get('content-length')}`);

    } catch (error) {
        console.error('Error testing:', error);
    }

    console.log('\n' + '='.repeat(80));
    console.log('🔧 CACHE BUSTING STEPS:');
    console.log('1. Update HTML with new cache busting version');
    console.log('2. Clear browser cache completely (Cmd+Shift+R or Ctrl+Shift+R)');
    console.log('3. Test in incognito/private window');
    console.log('4. Clear social media caches:');
    console.log('   - Facebook: https://developers.facebook.com/tools/debug/');
    console.log('   - Twitter: https://cards-dev.twitter.com/validator');
    console.log('   - LinkedIn: https://www.linkedin.com/post-inspector/');
    console.log('='.repeat(80));
}

testFaviconAndMeta();