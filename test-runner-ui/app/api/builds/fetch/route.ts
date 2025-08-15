import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function POST() {
  try {
    // Go up one level from test-runner-ui to main project
    const projectRoot = path.join(process.cwd(), '..');
    
    // Execute npm run build:fetch in the main project directory
    const { stdout, stderr } = await execAsync('npm run build:fetch', {
      cwd: projectRoot
    });
    
    console.log('Build fetch output:', stdout);
    if (stderr) console.error('Build fetch stderr:', stderr);
    
    return NextResponse.json({ 
      success: true,
      message: 'Builds fetched successfully',
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