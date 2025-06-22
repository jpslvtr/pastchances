import fetch from 'node-fetch';
import { execSync } from 'child_process';

async function debugCurrentDeployment() {
    console.log('='.repeat(80));
    console.log('DEBUGGING CURRENT DEPLOYMENT');
    console.log('='.repeat(80));

    try {
        // Get the latest deployment info
        console.log('\n📋 Latest Vercel deployments:');
        const deployments = execSync('npx vercel ls', { encoding: 'utf8', cwd: '../..' });
        console.log(deployments);

        // Get domain assignments
        console.log('\n🌐 Domain assignments:');
        try {
            const aliases = execSync('npx vercel alias ls', { encoding: 'utf8', cwd: '../..' });
            console.log(aliases);
        } catch (error) {
            console.log('Error getting aliases:', error.message);
        }

        // Extract the first deployment URL from the list
        const deploymentLines = deployments.split('\n');
        let latestDeploymentUrl = null;

        for (const line of deploymentLines) {
            const urlMatch = line.match(/https:\/\/stanford-lastchances-[a-z0-9]+-jpslvtrs-projects\.vercel\.app/);
            if (urlMatch) {
                latestDeploymentUrl = urlMatch[0];
                break;
            }
        }

        if (latestDeploymentUrl) {
            console.log(`\n🔍 Testing latest deployment directly: ${latestDeploymentUrl}`);

            const images = ['/stanford.png', '/stanford.svg', '/share.png'];
            for (const imagePath of images) {
                try {
                    const response = await fetch(`${latestDeploymentUrl}${imagePath}`);
                    console.log(`   ${imagePath}: ${response.status} (${response.headers.get('content-type')})`);
                } catch (error) {
                    console.log(`   ${imagePath}: ERROR - ${error.message}`);
                }
            }
        } else {
            console.log('❌ Could not find latest deployment URL');
        }

        // Test the custom domain
        console.log('\n🔍 Testing custom domain: https://pastchances.com');
        const images = ['/stanford.png', '/stanford.svg', '/share.png'];
        for (const imagePath of images) {
            try {
                const response = await fetch(`https://pastchances.com${imagePath}`);
                console.log(`   ${imagePath}: ${response.status} (${response.headers.get('content-type')})`);
            } catch (error) {
                console.log(`   ${imagePath}: ERROR - ${error.message}`);
            }
        }

    } catch (error) {
        console.error('Error debugging deployment:', error.message);
    }

    console.log('\n' + '='.repeat(80));
}

debugCurrentDeployment();