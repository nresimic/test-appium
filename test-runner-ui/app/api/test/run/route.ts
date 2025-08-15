import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { promises as fs } from 'fs';

const execAsync = promisify(exec);

interface TestConfig {
  platform: 'ios' | 'android';
  build: string;
  device: string;
  testMode: 'full' | 'single';
  test?: string;
  testCase?: string;
}

// Helper functions for persistent storage
const getRunningTestsPath = () => {
  return path.join(process.cwd(), 'running-tests.json');
};

async function loadRunningTests(): Promise<Map<string, any>> {
  try {
    const data = await fs.readFile(getRunningTestsPath(), 'utf-8');
    const tests = JSON.parse(data);
    return new Map(tests.map((t: any) => [t.id, t]));
  } catch {
    return new Map();
  }
}

async function saveRunningTests(testsMap: Map<string, any>) {
  const tests = Array.from(testsMap.values());
  await fs.writeFile(getRunningTestsPath(), JSON.stringify(tests, null, 2));
}

// Parse test results from WebdriverIO output
function parseTestResults(output: string): { passed: number; failed: number; broken: number; skipped: number; total: number } {
  const counters = {
    passed: 0,
    failed: 0,
    broken: 0,
    skipped: 0,
    total: 0
  };
  
  if (!output) return counters;
  
  // Debug: Log a sample of the output to understand the format
  console.log('[TEST PARSER] Sample output:', output.substring(output.length - 500));
  
  // Look for the spec reporter summary at the end
  // Format: "Spec Files:	 1 passed, 1 failed, 2 skipped, 4 total"
  const specFilesMatch = output.match(/Spec Files:\s*(\d+)\s+passed(?:,\s*(\d+)\s+failed)?(?:,\s*(\d+)\s+skipped)?(?:,\s*(\d+)\s+total)?/);
  
  // Look for test results summary
  // Format: "Tests:       13 passed, 1 failed, 7 skipped, 21 total"
  const testsMatch = output.match(/Tests:\s*(\d+)\s+passed(?:,\s*(\d+)\s+failed)?(?:,\s*(\d+)\s+skipped)?(?:,\s*(\d+)\s+total)?/);
  
  // Alternative format from mocha
  // Example: "13 passing (1m 30s)"
  // Example: "13 passing (1m 30s)\n  1 failing\n  7 pending"
  const passingMatch = output.match(/(\d+)\s+passing/);
  const failingMatch = output.match(/(\d+)\s+failing/);
  const pendingMatch = output.match(/(\d+)\s+pending/);
  const skippedMatch = output.match(/(\d+)\s+skipped/);
  
  // Use Tests line if available (most accurate)
  if (testsMatch) {
    counters.passed = parseInt(testsMatch[1]) || 0;
    counters.failed = parseInt(testsMatch[2]) || 0;
    counters.skipped = parseInt(testsMatch[3]) || 0;
    counters.total = parseInt(testsMatch[4]) || 0;
    console.log('[TEST PARSER] Found Tests summary:', counters);
  }
  // Otherwise try mocha format
  else if (passingMatch || failingMatch || pendingMatch || skippedMatch) {
    if (passingMatch) counters.passed = parseInt(passingMatch[1]);
    if (failingMatch) counters.failed = parseInt(failingMatch[1]);
    if (pendingMatch) counters.skipped = parseInt(pendingMatch[1]);
    if (skippedMatch) counters.skipped = parseInt(skippedMatch[1]);
    counters.total = counters.passed + counters.failed + counters.skipped;
    console.log('[TEST PARSER] Found mocha format:', counters);
  }
  
  // If still no results, look for individual test results
  if (counters.total === 0) {
    // Count ✓ for passed tests
    const passedTests = (output.match(/✓/g) || []).length;
    // Count ✗ or ✖ for failed tests  
    const failedTests = (output.match(/[✗✖]/g) || []).length;
    // Count - for skipped/pending tests
    const skippedTests = (output.match(/\s-\s/g) || []).length;
    
    if (passedTests > 0 || failedTests > 0 || skippedTests > 0) {
      counters.passed = passedTests;
      counters.failed = failedTests;
      counters.skipped = skippedTests;
      counters.total = passedTests + failedTests + skippedTests;
      console.log('[TEST PARSER] Counted individual test markers:', counters);
    }
  }
  
  // Fallback: if no tests detected, assume single test based on exit code
  if (counters.total === 0) {
    counters.total = 1;
    console.log('[TEST PARSER] No test counts found, using fallback');
  }
  
  return counters;
}

// Helper function to save test to history
async function saveToHistory(runId: string, test: any, config: TestConfig) {
  try {
    const projectRoot = path.join(process.cwd(), '..');
    const historyPath = path.join(process.cwd(), 'test-history.json');
    
    // Calculate duration
    const duration = test.endTime && test.startTime 
      ? Math.floor((new Date(test.endTime).getTime() - new Date(test.startTime).getTime()) / 1000)
      : 0;
    
    // Don't parse test results from output as it's unreliable
    // The Allure report will have accurate counts
    const testCounters = {
      passed: 0,
      failed: 0,
      broken: 0,
      skipped: 0,
      total: 0
    };
    
    // Generate and save Allure report with unique name
    let allureReportUrl = null;
    const allureResultsPath = path.join(projectRoot, 'allure-results');
    const allureReportsDir = path.join(process.cwd(), 'allure-reports');
    const runResultsPath = path.join(projectRoot, 'allure-results-temp', runId);
    
    try {
      // Check if allure-results exist
      await fs.access(allureResultsPath);
      
      // Copy current results to a temporary directory for this run
      await fs.mkdir(path.join(projectRoot, 'allure-results-temp'), { recursive: true });
      await execAsync(`cp -r ${allureResultsPath}/* ${runResultsPath}/`, { cwd: projectRoot }).catch(() => {
        // If copy fails, try to create directory and copy again
        return execAsync(`mkdir -p ${runResultsPath} && cp -r ${allureResultsPath}/* ${runResultsPath}/`, { cwd: projectRoot });
      });
      
      // Create allure-reports directory if it doesn't exist
      await fs.mkdir(allureReportsDir, { recursive: true });
      
      // Generate Allure report from the isolated results directory
      const reportDir = path.join(allureReportsDir, runId);
      await execAsync(`npx allure generate ${runResultsPath} --clean --single-file -o ${reportDir}`, { cwd: projectRoot });
      
      console.log(`[TEST RUN ${runId}] Allure report generated at ${reportDir}`);
      allureReportUrl = `/api/allure/report?runId=${runId}`;
      
      // Clean up temporary results directory
      await execAsync(`rm -rf ${runResultsPath}`, { cwd: projectRoot }).catch(() => {});
    } catch (error) {
      console.log(`[TEST RUN ${runId}] No Allure report generated:`, error);
      // Try to clean up even if report generation failed
      await execAsync(`rm -rf ${runResultsPath}`, { cwd: projectRoot }).catch(() => {});
    }
    
    // Create history entry with parsed counters
    const historyEntry = {
      id: runId,
      name: config.testMode === 'single' && config.test 
        ? `Single: ${config.test.split('/').pop()}`
        : 'Full Test Suite',
      status: test.status,
      result: test.result,
      created: test.startTime,
      duration,
      device: config.device,
      platform: config.platform,
      build: config.build,
      counters: {
        passed: testCounters.passed,
        failed: testCounters.failed,
        broken: testCounters.broken,
        skipped: testCounters.skipped,
        total: testCounters.total
      },
      artifactsUrl: allureReportUrl,
      hasAllureReport: true, // Local tests generate Allure reports
      isDeviceFarm: false
    };
    
    // Load existing history
    let history = [];
    try {
      const data = await fs.readFile(historyPath, 'utf-8');
      history = JSON.parse(data);
    } catch {
      // File doesn't exist yet
    }
    
    // Add new entry and save
    history.unshift(historyEntry);
    if (history.length > 50) {
      history.splice(50);
    }
    
    await fs.writeFile(historyPath, JSON.stringify(history, null, 2));
    console.log(`[TEST RUN ${runId}] Saved to history`);
  } catch (error) {
    console.error(`[TEST RUN ${runId}] Failed to save to history:`, error);
  }
}

export async function POST(request: Request) {
  try {
    const config: TestConfig = await request.json();
    const runId = `run-${Date.now()}`;
    
    // Go up one level from test-runner-ui to main project
    const projectRoot = path.join(process.cwd(), '..');
    
    // Clear previous allure-results before running new test
    const allureResultsPath = path.join(projectRoot, 'allure-results');
    await execAsync(`rm -rf ${allureResultsPath}/*`, { cwd: projectRoot }).catch(() => {
      console.log(`[TEST RUN ${runId}] No previous allure results to clear`);
    });
    
    // Build the wdio command
    let command = '';
    const configFile = config.platform === 'ios' 
      ? 'config/wdio.ios.conf.ts' 
      : 'config/wdio.android.conf.ts';
    
    if (config.testMode === 'single' && config.test) {
      // Run specific test file - remove the leading ../ if present
      const testPath = config.test.startsWith('../') ? config.test.substring(3) : config.test;
      command = `npx wdio ${configFile} --spec ${testPath}`;
      
      if (config.testCase) {
        // Run specific test case using grep
        command += ` --mochaOpts.grep "${config.testCase}"`;
      }
    } else {
      // Run full suite
      command = `npx wdio ${configFile}`;
    }
    
    // Load existing running tests
    const runningTests = await loadRunningTests();
    
    // Store test metadata
    runningTests.set(runId, {
      id: runId,
      name: config.testMode === 'single' && config.test 
        ? `Single: ${config.test.split('/').pop()}`
        : 'Full Test Suite',
      config,
      status: 'RUNNING',
      created: new Date().toISOString(),
      startTime: new Date().toISOString(),
      device: config.device,
      platform: config.platform,
      build: config.build,
      command
    });
    
    // Save to persistent storage
    await saveRunningTests(runningTests);
    
    // Execute test asynchronously
    console.log(`[TEST RUN ${runId}] Starting command: ${command}`);
    console.log(`[TEST RUN ${runId}] Working directory: ${projectRoot}`);
    
    execAsync(command, { 
      cwd: projectRoot,
      maxBuffer: 1024 * 1024 * 50, // Increase buffer to 50MB to prevent EPIPE
      env: {
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=4096' // Increase Node memory limit
      }
    })
      .then(async ({ stdout, stderr }) => {
        console.log(`[TEST RUN ${runId}] Test completed successfully`);
        // Load current running tests
        const runningTests = await loadRunningTests();
        const test = runningTests.get(runId);
        if (test) {
          test.status = 'COMPLETED';
          test.result = 'PASSED';
          test.output = stdout;
          test.error = stderr;
          test.endTime = new Date().toISOString();
          
          // Save to history
          await saveToHistory(runId, test, config);
          
          // Remove from running tests
          runningTests.delete(runId);
          await saveRunningTests(runningTests);
        }
      })
      .catch(async (error) => {
        console.error(`[TEST RUN ${runId}] Test failed:`, error.message);
        // Load current running tests
        const runningTests = await loadRunningTests();
        const test = runningTests.get(runId);
        if (test) {
          test.status = 'COMPLETED';
          test.result = 'FAILED';
          test.error = error.message;
          test.output = error.stdout || '';
          test.endTime = new Date().toISOString();
          
          // Save to history
          await saveToHistory(runId, test, config);
          
          // Remove from running tests
          runningTests.delete(runId);
          await saveRunningTests(runningTests);
        }
      });
    
    return NextResponse.json({ 
      runId,
      message: 'Test started',
      command
    });
  } catch (error: any) {
    console.error('Failed to start test:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}

// GET endpoint to check test status
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get('runId');
  
  // Load running tests from persistent storage
  const runningTests = await loadRunningTests();
  
  if (!runId) {
    return NextResponse.json({ 
      tests: Array.from(runningTests.values()) 
    });
  }
  
  const test = runningTests.get(runId);
  if (!test) {
    return NextResponse.json({ 
      error: 'Test not found' 
    }, { status: 404 });
  }
  
  // Check for Allure report
  let allureReportUrl = null;
  if (test.status === 'COMPLETED') {
    const projectRoot = path.join(process.cwd(), '..');
    const allureReportPath = path.join(projectRoot, 'allure-report', 'index.html');
    
    try {
      await fs.access(allureReportPath);
      allureReportUrl = '/allure-report/index.html';
    } catch {
      // No allure report available
    }
  }
  
  return NextResponse.json({
    ...test,
    allureReportUrl
  });
}