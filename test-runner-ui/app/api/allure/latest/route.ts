import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Look for the main allure-report directory in the parent project
    const projectRoot = path.join(process.cwd(), '..');
    const allureReportPath = path.join(projectRoot, 'allure-report', 'index.html');
    
    // Check if the main report exists
    await fs.access(allureReportPath);
    
    // Redirect to the allure-report endpoint that serves the static files
    return NextResponse.redirect(new URL('/api/allure-report/index.html', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002'));
  } catch (error) {
    console.error('No overall Allure report found:', error);
    
    return NextResponse.json({ 
      error: 'No overall test report available',
      message: 'Run tests to generate an Allure report'
    }, { status: 404 });
  }
}