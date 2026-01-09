/**
 * electron-builder afterSign hook
 * Handles macOS notarization after signing
 */

const { notarize } = require('@electron/notarize');
const path = require('path');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  // Only notarize macOS builds
  if (electronPlatformName !== 'darwin') {
    console.log('Skipping notarization: not macOS');
    return;
  }

  // Check for required environment variables
  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !teamId) {
    console.log('Skipping notarization: missing credentials');
    console.log('  APPLE_ID:', appleId ? 'set' : 'missing');
    console.log('  APPLE_APP_SPECIFIC_PASSWORD:', appleIdPassword ? 'set' : 'missing');
    console.log('  APPLE_TEAM_ID:', teamId ? 'set' : 'missing');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`Notarizing ${appPath}...`);
  console.log('This may take several minutes...');

  try {
    await notarize({
      tool: 'notarytool',
      appPath,
      appleId,
      appleIdPassword,
      teamId,
    });

    console.log('✅ Notarization complete!');
  } catch (error) {
    console.error('❌ Notarization failed:', error.message);
    
    // Don't fail the build if notarization fails in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Continuing build despite notarization failure (development mode)');
      return;
    }
    
    throw error;
  }
};
