import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get('runId');
  
  if (!runId) {
    return NextResponse.json({ 
      error: 'Missing runId parameter' 
    }, { status: 400 });
  }
  
  try {
    // Look for saved report in allure-reports directory
    const allureReportsDir = path.join(process.cwd(), 'allure-reports');
    const reportPath = path.join(allureReportsDir, runId, 'index.html');
    
    // Check if report exists
    const htmlContent = await fs.readFile(reportPath, 'utf-8');
    
    return new Response(htmlContent, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    });
  } catch (error: any) {
    console.error(`Failed to serve report for ${runId}:`, error);
    
    // Fallback: Try to serve the latest report from main allure-report directory
    try {
      const projectRoot = path.join(process.cwd(), '..');
      const fallbackPath = path.join(projectRoot, 'allure-report', 'index.html');
      const htmlContent = await fs.readFile(fallbackPath, 'utf-8');
      
      return new Response(htmlContent, {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache'
        }
      });
    } catch (fallbackError) {
      return NextResponse.json({ 
        error: 'Report not found',
        runId,
        details: error.message
      }, { status: 404 });
    }
  }
}