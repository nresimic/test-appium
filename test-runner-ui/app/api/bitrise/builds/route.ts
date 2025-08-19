import { NextRequest, NextResponse } from 'next/server';
import { BitriseService } from '../../../../../services/bitrise/bitrise.service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch');
    
    if (!branch) {
      return NextResponse.json({ 
        success: false,
        error: 'Branch parameter is required' 
      }, { status: 400 });
    }

    const bitrise = new BitriseService();
    const builds = await bitrise.getBuildConfigurations(branch, 10);
    
    return NextResponse.json({ 
      success: true,
      builds,
      branch
    });
  } catch (error: any) {
    console.error('Failed to fetch builds for branch:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message,
      builds: []
    }, { status: 500 });
  }
}