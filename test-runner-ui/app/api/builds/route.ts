import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

interface Build {
  id: string;
  filename: string;
  version: string;
  platform: 'ios' | 'android';
  size: number;
  created: string;
  path: string;
}

async function scanDirectory(dir: string, platform: 'ios' | 'android'): Promise<Build[]> {
  const builds: Build[] = [];
  
  try {
    const files = await fs.readdir(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isFile()) {
        let isValidBuild = false;
        
        if (platform === 'android' && file.endsWith('.apk')) {
          isValidBuild = true;
        } else if (platform === 'ios' && (file.endsWith('.app.zip') || file.endsWith('.zip') || file.endsWith('.ipa'))) {
          isValidBuild = true;
        }
        
        if (isValidBuild) {
          // Extract version from filename (e.g., app-UAE-main-build-53.apk)
          const versionMatch = file.match(/(\d+\.\d+\.\d+)/);
          const buildNumberMatch = file.match(/build-(\d+)/);
          const version = versionMatch ? versionMatch[1] : (buildNumberMatch ? `build-${buildNumberMatch[1]}` : 'unknown');
          
          builds.push({
            id: file,
            filename: file,
            version,
            platform,
            size: stats.size,
            created: stats.mtime.toISOString(),
            path: `apps/${platform}/${file}`
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error reading ${platform} directory:`, error);
  }
  
  return builds;
}

export async function GET() {
  try {
    // Go up one level from test-runner-ui to main project
    const projectRoot = path.join(process.cwd(), '..');
    
    // Check both android and ios subdirectories
    const androidDir = path.join(projectRoot, 'apps', 'android');
    const iosDir = path.join(projectRoot, 'apps', 'ios');
    
    const [androidBuilds, iosBuilds] = await Promise.all([
      scanDirectory(androidDir, 'android'),
      scanDirectory(iosDir, 'ios')
    ]);
    
    const allBuilds = [...androidBuilds, ...iosBuilds];
    
    // Sort by creation date (newest first)
    allBuilds.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
    
    return NextResponse.json({ builds: allBuilds });
  } catch (error) {
    console.error('Error fetching builds:', error);
    return NextResponse.json({ error: 'Failed to fetch builds' }, { status: 500 });
  }
}