#!/usr/bin/env npx tsx

import * as dotenv from 'dotenv';
import { BitriseService } from '../services/bitrise/bitrise.service';

dotenv.config({ debug: false });

interface FetchOptions {
  branch?: string;
  force?: boolean;
  updateConfig?: boolean;
}

async function fetchBuilds(options: FetchOptions = {}) {
  const {
    branch = process.env.BRANCH || 'develop',
    force = false,
    updateConfig = true
  } = options;

  console.log('========================================');
  console.log('  Bitrise APK Fetcher');
  console.log('========================================\n');

  try {
    const bitrise = new BitriseService();

    // Check if we need to download
    if (!force) {
      const cacheCheck = await bitrise.isLatestBuildCached(branch);
      if (cacheCheck.cached) {
        console.log(`✅ Already have latest build for ${branch}`);
        const cachedPath = bitrise.getCachedAPKPath(branch);
        if (cachedPath) {
          console.log(`📦 Cached APK: ${cachedPath}`);
          
          if (updateConfig) {
            bitrise.updateWdioConfig(cachedPath);
          }
        }
        return cachedPath;
      }
    }

    // Download latest APK
    const apkPath = await bitrise.downloadLatestAPK(branch, force);
    
    if (apkPath && updateConfig) {
      bitrise.updateWdioConfig(apkPath);
    }

    return apkPath;
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options: FetchOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--branch' && args[i + 1]) {
      options.branch = args[++i];
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--no-update-config') {
      options.updateConfig = false;
    } else if (arg === '--help') {
      console.log(`
Usage: npx tsx scripts/fetch-builds.ts [options]

Options:
  --branch <branch>     Branch to fetch builds from (default: develop)
  --force              Force download even if cached
  --no-update-config   Don't update wdio config file
  --help               Show this help message

Examples:
  npx tsx scripts/fetch-builds.ts
  npx tsx scripts/fetch-builds.ts --branch main
  npx tsx scripts/fetch-builds.ts --force
`);
      process.exit(0);
    }
  }

  fetchBuilds(options);
}

export { fetchBuilds };