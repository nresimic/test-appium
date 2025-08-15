import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const runId = searchParams.get('runId');
  
  const projectRoot = path.join(process.cwd(), '..');
  const allureResultsPath = path.join(projectRoot, 'allure-results');
  const allureReportsDir = path.join(process.cwd(), 'allure-reports');
  const allureReportPath = runId 
    ? path.join(allureReportsDir, runId)
    : path.join(projectRoot, 'allure-report');
  
  try {
    if (action === 'check') {
      // Check if Allure report exists
      try {
        await fs.access(allureReportPath);
        const indexPath = path.join(allureReportPath, 'index.html');
        await fs.access(indexPath);
        
        return NextResponse.json({ 
          exists: true,
          path: allureReportPath
        });
      } catch {
        return NextResponse.json({ 
          exists: false,
          message: 'No Allure report found'
        });
      }
    }
    
    if (action === 'generate') {
      // Generate Allure report from results
      try {
        await fs.access(allureResultsPath);
        
        // Generate single-file report
        const { stdout, stderr } = await execAsync(
          'npx allure generate allure-results --clean --single-file -o allure-report',
          { cwd: projectRoot }
        );
        
        if (stderr && !stderr.includes('Report successfully generated')) {
          console.error('Allure generation warning:', stderr);
        }
        
        return NextResponse.json({ 
          success: true,
          message: 'Allure report generated successfully',
          output: stdout
        });
      } catch (error: any) {
        return NextResponse.json({ 
          success: false,
          error: error.message,
          message: 'Failed to generate Allure report'
        }, { status: 500 });
      }
    }
    
    if (action === 'serve') {
      // Serve the Allure report HTML
      try {
        const indexPath = path.join(allureReportPath, 'index.html');
        const htmlContent = await fs.readFile(indexPath, 'utf-8');
        
        return new Response(htmlContent, {
          headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache'
          }
        });
      } catch (error: any) {
        // Try to generate the report first
        try {
          await execAsync(
            'npx allure generate allure-results --clean --single-file -o allure-report',
            { cwd: projectRoot }
          );
          
          const indexPath = path.join(allureReportPath, 'index.html');
          const htmlContent = await fs.readFile(indexPath, 'utf-8');
          
          return new Response(htmlContent, {
            headers: {
              'Content-Type': 'text/html',
              'Cache-Control': 'no-cache'
            }
          });
        } catch (genError: any) {
          return NextResponse.json({ 
            error: 'No Allure report available. Run tests first.',
            details: genError.message
          }, { status: 404 });
        }
      }
    }
    
    // Default: return report status
    try {
      await fs.access(allureReportPath);
      const stats = await fs.stat(allureReportPath);
      
      return NextResponse.json({ 
        exists: true,
        modified: stats.mtime,
        size: stats.size
      });
    } catch {
      return NextResponse.json({ 
        exists: false,
        message: 'No Allure report found. Run tests to generate a report.'
      });
    }
    
  } catch (error: any) {
    console.error('Allure API error:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}

// POST endpoint to generate Allure report
export async function POST(request: Request) {
  try {
    const { singleFile = true } = await request.json();
    
    const projectRoot = path.join(process.cwd(), '..');
    const allureResultsPath = path.join(projectRoot, 'allure-results');
    
    // Check if results exist
    try {
      await fs.access(allureResultsPath);
    } catch {
      return NextResponse.json({ 
        error: 'No test results found. Run tests first.'
      }, { status: 404 });
    }
    
    // Generate report
    const command = singleFile ? 
      'npx allure generate allure-results --clean --single-file -o allure-report' :
      'npx allure generate allure-results --clean -o allure-report';
    
    const { stdout, stderr } = await execAsync(command, { cwd: projectRoot });
    
    if (stderr && !stderr.includes('Report successfully generated')) {
      console.error('Allure generation warning:', stderr);
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Allure report generated successfully',
      singleFile,
      output: stdout
    });
    
  } catch (error: any) {
    console.error('Failed to generate Allure report:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}