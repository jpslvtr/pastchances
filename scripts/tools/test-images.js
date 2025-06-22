import fetch from 'node-fetch';
import { execSync } from 'child_process';

async function testImages() {
    console.log('='.repeat(80));
    console.log('COMPREHENSIVE IMAGE TESTING');
    console.log('='.repeat(80));

    // Check latest Vercel deployment info
    try {
        console.log('\n📋 Checking Vercel deployments...');
        const deployments = execSync('npx vercel ls', { encoding: 'utf8', cwd: '../..' });
        console.log(deployments.split('\n').slice(0, 5).join('\n')); // Show first 5 lines
    } catch (error) {
        console.log('Could not get deployment info:', error.message);
    }

    const baseUrl = 'https://pastchances.com';
    const images = [
        { path: '/stanford.png', description: 'Favicon PNG', critical: true },
        { path: '/stanford.svg', description: 'Favicon SVG', critical: true },
        { path: '/share.png', description: 'Social Media Preview', critical: true },
        { path: '/robots.txt', description: 'Robots.txt', critical: false },
        { path: '/sitemap.xml', description: 'Sitemap', critical: false }
    ];

    let allCriticalPassed = true;

    for (const { path, description, critical } of images) {
        const imageUrl = `${baseUrl}${path}`;
        try {
            console.log(`\n🔍 Testing ${description}: ${imageUrl}`);

            const response = await fetch(imageUrl, {
                method: 'HEAD',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; social-media-crawler/1.0)',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });

            console.log(`   Status: ${response.status} ${response.statusText}`);
            console.log(`   Content-Type: ${response.headers.get('content-type')}`);
            console.log(`   Content-Length: ${response.headers.get('content-length')}`);

            if (response.status !== 200) {
                const icon = critical ? '❌ CRITICAL' : '⚠️ WARNING';
                console.log(`   ${icon}: ${description} not accessible`);

                if (critical) {
                    allCriticalPassed = false;
                }

                // Get error details
                try {
                    const getResponse = await fetch(imageUrl);
                    const errorText = await getResponse.text();
                    console.log(`   Error: ${errorText.substring(0, 200)}...`);
                } catch (e) {
                    console.log(`   Could not get error details: ${e.message}`);
                }
            } else {
                console.log(`   ✅ SUCCESS: ${description} is accessible`);
            }

        } catch (error) {
            console.log(`   ❌ ERROR: ${error.message}`);
            if (critical) {
                allCriticalPassed = false;
            }
        }
    }

    // Test main page meta tags
    console.log('\n🔍 Testing main page meta tags...');
    try {
        const response = await fetch(baseUrl);
        const html = await response.text();

        // Check for cache-busted URLs (which we want to avoid)
        const cacheBustedLinks = html.match(/href="[^"]*\?v=\d+[^"]*"/g);
        if (cacheBustedLinks) {
            console.log('   ⚠️ Found cache-busted URLs (should be removed):');
            cacheBustedLinks.forEach(link => console.log(`     ${link}`));
        } else {
            console.log('   ✅ No cache-busted URLs found');
        }

        // Check Open Graph image
        const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
        if (ogImageMatch) {
            console.log(`   ✅ og:image: ${ogImageMatch[1]}`);
        } else {
            console.log('   ❌ No og:image found');
        }

    } catch (error) {
        console.log(`   ❌ ERROR testing main page: ${error.message}`);
    }

    console.log('\n' + '='.repeat(80));
    if (allCriticalPassed) {
        console.log('🎉 ALL CRITICAL TESTS PASSED!');
        console.log('Your favicon and social media preview should now work.');
        console.log('\nFinal steps:');
        console.log('1. Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)');
        console.log('2. Test favicon in browser');
        console.log('3. Test social media preview links below');
    } else {
        console.log('❌ CRITICAL TESTS FAILED');
        console.log('Images are still not accessible. Check deployment logs.');
        console.log('\nTroubleshooting:');
        console.log('1. Check dist folder: ls -la ../../dist/*.png ../../dist/*.svg');
        console.log('2. Re-run deployment: cd ../.. && scripts/deploy.sh');
        console.log('3. Check Vercel deployment logs');
    }

    console.log('\nSOCIAL MEDIA DEBUGGING TOOLS:');
    console.log('Facebook: https://developers.facebook.com/tools/debug/');
    console.log('Twitter: https://cards-dev.twitter.com/validator');
    console.log('LinkedIn: https://www.linkedin.com/post-inspector/');
    console.log('='.repeat(80));
}

testImages();