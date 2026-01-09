/**
 * Check for updates script
 * Can be run independently to check for new versions
 */

const https = require('https');
const packageJson = require('../package.json');

const GITHUB_OWNER = 'your-repo';
const GITHUB_REPO = 'options-scanner';

async function checkForUpdates() {
  const currentVersion = packageJson.version;
  console.log(`Current version: ${currentVersion}`);
  console.log('Checking for updates...\n');

  try {
    const latestRelease = await getLatestRelease();
    
    if (latestRelease) {
      const latestVersion = latestRelease.tag_name.replace(/^v/, '');
      
      if (isNewerVersion(latestVersion, currentVersion)) {
        console.log(`🎉 New version available: ${latestVersion}`);
        console.log(`   Current: ${currentVersion}`);
        console.log(`\n   Release: ${latestRelease.html_url}`);
        console.log(`   Published: ${new Date(latestRelease.published_at).toLocaleDateString()}`);
        
        if (latestRelease.body) {
          console.log(`\n   Release notes:\n   ${latestRelease.body.split('\n').join('\n   ')}`);
        }
      } else {
        console.log('✅ You are running the latest version.');
      }
    } else {
      console.log('No releases found.');
    }
  } catch (error) {
    console.error('Error checking for updates:', error.message);
  }
}

function getLatestRelease() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      method: 'GET',
      headers: {
        'User-Agent': 'options-scanner-updater'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else if (res.statusCode === 404) {
          resolve(null);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function isNewerVersion(latest, current) {
  const latestParts = latest.split('.').map(Number);
  const currentParts = current.split('.').map(Number);
  
  for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
    const latestPart = latestParts[i] || 0;
    const currentPart = currentParts[i] || 0;
    
    if (latestPart > currentPart) return true;
    if (latestPart < currentPart) return false;
  }
  
  return false;
}

// Run
checkForUpdates();
