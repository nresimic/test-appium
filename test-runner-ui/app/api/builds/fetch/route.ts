import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { platform = 'android', branch = 'main', buildSlug } = await request.json().catch(() => ({}));
    
    // Validate parameters
    const validPlatforms = ['android', 'ios'];
    
    if (!validPlatforms.includes(platform)) {
      return NextResponse.json({ 
        success: false,
        error: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}` 
      }, { status: 400 });
    }
    
    if (!branch || typeof branch !== 'string') {
      return NextResponse.json({ 
        success: false,
        error: 'Branch parameter is required and must be a string' 
      }, { status: 400 });
    }
    
    // Go up one level from test-runner-ui to main project
    const projectRoot = path.join(process.cwd(), '..');
    
    // Execute npm run build:fetch with parameters
    let command = `npm run build:fetch -- --platform=${platform} --branch=${branch}`;
    if (buildSlug) {
      command += ` --buildSlug=${buildSlug}`;
    }
    console.log(`Executing: ${command}`);
    
    const { stdout, stderr } = await execAsync(command, {
      cwd: projectRoot,
      env: { ...process.env, FORCE_COLOR: '0' }
    });
    
    console.log('Build fetch output:', stdout);
    if (stderr) console.error('Build fetch stderr:', stderr);
    
    return NextResponse.json({ 
      success: true,
      message: `Successfully fetched ${platform} build from ${branch} branch`,
      platform,
      branch,
      output: stdout
    });
  } catch (error: any) {
    console.error('Failed to fetch builds:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
}