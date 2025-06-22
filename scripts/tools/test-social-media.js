import fetch from 'node-fetch';

async function testSocialMediaPreviews() {
    console.log('='.repeat(80));
    console.log('SOCIAL MEDIA PREVIEW TEST');
    console.log('='.repeat(80));

    const url = 'https://pastchances.com';

    try {
        // Test as Facebook crawler
        console.log('\n🔍 Testing as Facebook crawler:');
        const fbResponse = await fetch(url, {
            headers: {
                'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
            }
        });

        const fbHtml = await fbResponse.text();

        // Check for Open Graph tags
        const ogImage = fbHtml.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
        const ogTitle = fbHtml.match(/<meta\s+property="og:title"\s+content="([^"]+)"/);
        const ogDesc = fbHtml.match(/<meta\s+property="og:description"\s+content="([^"]+)"/);

        console.log(`   og:title: ${ogTitle ? ogTitle[1] : 'NOT FOUND'}`);
        console.log(`   og:description: ${ogDesc ? ogDesc[1] : 'NOT FOUND'}`);
        console.log(`   og:image: ${ogImage ? ogImage[1] : 'NOT FOUND'}`);

        if (ogImage) {
            // Test if the og:image URL works
            console.log('\n🔍 Testing og:image URL:');
            const imageResponse = await fetch(ogImage[1]);
            console.log(`   Status: ${imageResponse.status}`);
            console.log(`   Content-Type: ${imageResponse.headers.get('content-type')}`);
            console.log(`   Content-Length: ${imageResponse.headers.get('content-length')}`);
        }

        // Test as Twitter crawler
        console.log('\n🔍 Testing as Twitter crawler:');
        const twitterResponse = await fetch(url, {
            headers: {
                'User-Agent': 'Twitterbot/1.0'
            }
        });

        const twitterHtml = await twitterResponse.text();
        const twitterImage = twitterHtml.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/);
        const twitterCard = twitterHtml.match(/<meta\s+name="twitter:card"\s+content="([^"]+)"/);

        console.log(`   twitter:card: ${twitterCard ? twitterCard[1] : 'NOT FOUND'}`);
        console.log(`   twitter:image: ${twitterImage ? twitterImage[1] : 'NOT FOUND'}`);

    } catch (error) {
        console.error('Error testing social media:', error);
    }

    console.log('\n' + '='.repeat(80));
    console.log('🎯 NEXT STEPS:');
    console.log('1. Clear social media caches:');
    console.log('   - Facebook: https://developers.facebook.com/tools/debug/');
    console.log('   - Twitter: https://cards-dev.twitter.com/validator');
    console.log('   - LinkedIn: https://www.linkedin.com/post-inspector/');
    console.log('2. Test favicon by visiting https://pastchances.com in browser');
    console.log('3. Test link sharing on social platforms');
    console.log('='.repeat(80));
}

testSocialMediaPreviews();