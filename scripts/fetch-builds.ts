#!/usr/bin/env npx tsx

import * as dotenv from 'dotenv';
import { BitriseService } from '../services/bitrise/bitrise.service';

dotenv.config({ debug: false });

interface FetchOptions {
  branch?: string;
  platform?: 'android' | 'ios';
  buildSlug?: string;
  force?: boolean;
  updateConfig?: boolean;
}

async function fetchBuilds(options: FetchOptions = {}) {
  const {
    branch = 'main',
    platform = 'android',
    buildSlug,
    force = false,
    updateConfig = true
  } = options;
  
  const targetBranch = branch;

  console.log('========================================');
  console.log('  Bitrise Build Fetcher');
  console.log('========================================');
  console.log(`Platform: ${platform.toUpperCase()}`);
  console.log(`Branch: ${targetBranch}`);
  console.log('========================================\n');

  try {
    const bitrise = new BitriseService();

    // Check if we need to download (skip cache if specific buildSlug is requested)
    if (!force && !buildSlug) {
      const cacheCheck = await bitrise.isLatestBuildCached(targetBranch);
      if (cacheCheck.cached) {
        console.log(`✅ Already have latest ${platform} build for ${targetBranch}`);
        const cachedPath = bitrise.getCachedBuildPath(targetBranch, platform);
        if (cachedPath) {
          console.log(`📦 Cached ${platform.toUpperCase()}: ${cachedPath}`);
          
          if (updateConfig && platform === 'android') {
            bitrise.updateWdioConfig(cachedPath);
          }
        }
        return cachedPath;
      }
    }

    // Download build based on platform
    let buildPath: string | null;
    if (platform === 'ios') {
      if (buildSlug) {
        buildPath = await bitrise.downloadSpecificIPA(buildSlug, targetBranch, force);
      } else {
        buildPath = await bitrise.downloadLatestIPA(targetBranch, force);
      }
    } else {
      // Android
      if (buildSlug) {
        buildPath = await bitrise.downloadSpecificAPK(buildSlug, targetBranch, force);
      } else {
        buildPath = await bitrise.downloadLatestAPK(targetBranch, force);
      }
    }
    
    if (buildPath && updateConfig && platform === 'android') {
      bitrise.updateWdioConfig(buildPath);
    }

    return buildPath;
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  console.log('🔧 CLI Args received:', args);
  const options: FetchOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    // Handle both --key=value and --key value formats
    if (arg.startsWith('--branch=')) {
      options.branch = arg.split('=')[1];
    } else if (arg === '--branch' && args[i + 1]) {
      options.branch = args[++i];
    } else if (arg.startsWith('--buildSlug=')) {
      options.buildSlug = arg.split('=')[1];
    } else if (arg === '--buildSlug' && args[i + 1]) {
      options.buildSlug = args[++i];
    } else if (arg.startsWith('--platform=')) {
      const platform = arg.split('=')[1];
      if (['android', 'ios'].includes(platform)) {
        options.platform = platform as 'android' | 'ios';
      } else {
        console.error(`❌ Invalid platform: ${platform}. Must be 'android' or 'ios'`);
        process.exit(1);
      }
    } else if (arg === '--platform' && args[i + 1]) {
      const platform = args[++i];
      if (['android', 'ios'].includes(platform)) {
        options.platform = platform as 'android' | 'ios';
      } else {
        console.error(`❌ Invalid platform: ${platform}. Must be 'android' or 'ios'`);
        process.exit(1);
      }
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--no-update-config') {
      options.updateConfig = false;
    } else if (arg === '--help') {
      console.log(`
Usage: npx tsx scripts/fetch-builds.ts [options]

Options:
  --platform <platform>    Platform to fetch (android|ios) (default: android)
  --branch <branch>        Branch to fetch (default: main)
  --force                  Force download even if cached
  --no-update-config       Don't update wdio config file
  --help                   Show this help message

Examples:
  npx tsx scripts/fetch-builds.ts
  npx tsx scripts/fetch-builds.ts --platform android --branch main
  npx tsx scripts/fetch-builds.ts --platform ios --branch release-v6.5.0
  npx tsx scripts/fetch-builds.ts --branch develop --force
`);
      process.exit(0);
    }
  }

  console.log('🔧 Parsed options:', options);
  fetchBuilds(options);
}

export { fetchBuilds };