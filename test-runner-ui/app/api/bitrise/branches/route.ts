import { NextResponse } from 'next/server';
import { BitriseService } from '../../../../../services/bitrise/bitrise.service';

export async function GET() {
  try {
    const bitrise = new BitriseService();
    const branches = await bitrise.getAvailableBranches();
    
    return NextResponse.json({ 
      success: true,
      branches 
    });
  } catch (error: any) {
    console.error('Failed to fetch Bitrise branches:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message,
      branches: ['main'] // Fallback to main branch only
    }, { status: 500 });
  }
}