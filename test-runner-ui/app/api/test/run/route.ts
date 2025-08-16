import { NextResponse } from 'next/server';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { promises as fs } from 'fs';
import { TestConfig, TestCounters, TestRun, HistoryEntry, TestStorageData } from '../../../../../types';

const execAsync = promisify(exec);

// Helper functions for persistent storage
const getRunningTestsPath = () => {
  return path.join(process.cwd(), 'running-tests.json');
};

async function loadRunningTests(): Promise<Map<string, TestRun>> {
  try {
    const data = await fs.readFile(getRunningTestsPath(), 'utf-8');
    const tests = JSON.parse(data) as TestStorageData[];
    return new Map(tests.map((t: TestStorageData) => [t.id, t as unknown as TestRun]));
  } catch {
    return new Map();
  }
}

async function saveRunningTests(testsMap: Map<string, TestRun>) {
  const tests = Array.from(testsMap.values());
  await fs.writeFile(getRunningTestsPath(), JSON.stringify(tests, null, 2));
}

// Get expected tests based on configuration
async function getExpectedTests(config: TestConfig): Promise<string[]> {
  try {
    const projectRoot = path.join(process.cwd(), '..');
    
    if (config.testMode === 'single' && config.test) {
      // Single test file
      const testFilePath = path.join(projectRoot, config.test);
      const tests = await extractTestsFromFile(testFilePath);
      
      if (config.testCase) {
        // Specific test case
        return tests.filter(test => test.toLowerCase().includes(config.testCase!.toLowerCase()));
      } else if (config.tags && config.tags.length > 0) {
        // Filter by tags
        return tests.filter(test => 
          config.tags!.some(tag => test.toLowerCase().includes(tag.toLowerCase()))
        );
      } else {
        // All tests in the file
        return tests;
      }
    } else {
      // Full suite
      const testDir = path.join(projectRoot, 'test');
      const testFiles = await findTestFiles(testDir);
      let allTests: string[] = [];
      
      for (const filePath of testFiles) {
        const testsInFile = await extractTestsFromFile(filePath);
        allTests.push(...testsInFile);
      }
      
      if (config.tags && config.tags.length > 0) {
        // Filter by tags
        return allTests.filter(test => 
          config.tags!.some(tag => test.toLowerCase().includes(tag.toLowerCase()))
        );
      } else {
        // All tests
        return allTests;
      }
    }
  } catch (error) {
    console.error('Error getting expected tests:', error);
    return [];
  }
}

async function extractTestsFromFile(filePath: string): Promise<string[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const testPattern = /it(?:\.only)?\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const tests: string[] = [];
    let match;
    
    while ((match = testPattern.exec(content)) !== null) {
      tests.push(match[1]);
    }
    
    return tests;
  } catch (error) {
    console.error(`Error reading test file ${filePath}:`, error);
    return [];
  }
}

async function findTestFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        const subFiles = await findTestFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.name.endsWith('.e2e.ts') || entry.name.endsWith('.e2e.js')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
  
  return files;
}

// Simple parsing to update currently running test (optional)
async function parseTestOutput(runId: string, output: string) {
  try {
    const runningTests = await loadRunningTests();
    const test = runningTests.get(runId);
    if (!test) return;

    // Just extract currently completed test for status update
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes('✓')) {
        const testMatch = line.match(/✓\s*(.*?)(?:\s*\(\d+ms\))?$/);
        if (testMatch && testMatch[1]) {
          const testName = testMatch[1].trim();
          if (testName && !testName.includes('spec')) {
            test.currentlyRunningTest = testName;
            runningTests.set(runId, test);
            await saveRunningTests(runningTests);
            break;
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error parsing test output for ${runId}:`, error);
  }
}

function parseTestResults(output: string): TestCounters {
  const counters: TestCounters = {
    passed: 0,
    failed: 0,
    broken: 0,
    skipped: 0,
    total: 0
  };
  
  if (!output) return counters;
  
  console.log('[TEST PARSER] Sample output:', output.substring(output.length - 500));
  
  const parsedFromSummary = tryParseSummaryFormat(output, counters);
  if (parsedFromSummary) return counters;
  
  const parsedFromMocha = tryParseMochaFormat(output, counters);
  if (parsedFromMocha) return counters;
  
  const parsedFromMarkers = tryParseTestMarkers(output, counters);
  if (parsedFromMarkers) return counters;
  
  counters.total = 1;
  console.log('[TEST PARSER] No test counts found, using fallback');
  return counters;
}

function tryParseSummaryFormat(output: string, counters: TestCounters): boolean {
  const testsMatch = output.match(/Tests:\s*(\d+)\s+passed(?:,\s*(\d+)\s+failed)?(?:,\s*(\d+)\s+skipped)?(?:,\s*(\d+)\s+total)?/);
  
  if (testsMatch) {
    counters.passed = parseInt(testsMatch[1]) || 0;
    counters.failed = parseInt(testsMatch[2]) || 0;
    counters.skipped = parseInt(testsMatch[3]) || 0;
    counters.total = parseInt(testsMatch[4]) || 0;
    console.log('[TEST PARSER] Found Tests summary:', counters);
    return true;
  }
  return false;
}

function tryParseMochaFormat(output: string, counters: TestCounters): boolean {
  const passingMatch = output.match(/(\d+)\s+passing/);
  const failingMatch = output.match(/(\d+)\s+failing/);
  const pendingMatch = output.match(/(\d+)\s+pending/);
  const skippedMatch = output.match(/(\d+)\s+skipped/);
  
  if (passingMatch || failingMatch || pendingMatch || skippedMatch) {
    if (passingMatch) counters.passed = parseInt(passingMatch[1]);
    if (failingMatch) counters.failed = parseInt(failingMatch[1]);
    if (pendingMatch) counters.skipped = parseInt(pendingMatch[1]);
    if (skippedMatch) counters.skipped = parseInt(skippedMatch[1]);
    counters.total = counters.passed + counters.failed + counters.skipped;
    console.log('[TEST PARSER] Found mocha format:', counters);
    return true;
  }
  return false;
}

function tryParseTestMarkers(output: string, counters: TestCounters): boolean {
  const passedTests = (output.match(/✓/g) || []).length;
  const failedTests = (output.match(/[✗✖]/g) || []).length;
  const skippedTests = (output.match(/\s-\s/g) || []).length;
  
  if (passedTests > 0 || failedTests > 0 || skippedTests > 0) {
    counters.passed = passedTests;
    counters.failed = failedTests;
    counters.skipped = skippedTests;
    counters.total = passedTests + failedTests + skippedTests;
    console.log('[TEST PARSER] Counted individual test markers:', counters);
    return true;
  }
  return false;
}

// Helper function to save test to history
async function saveToHistory(runId: string, test: TestRun, config: TestConfig) {
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
      
      if (config.testCase && config.tags && config.tags.length > 0) {
        // Combine test case and tags
        const tagPattern = config.tags.join('.*');
        command += ` --mochaOpts.grep "${config.testCase}.*${tagPattern}"`;
      } else if (config.testCase) {
        // Run specific test case using grep
        command += ` --mochaOpts.grep "${config.testCase}"`;
      } else if (config.tags && config.tags.length > 0) {
        // Only tags for specific test file
        const tagPattern = config.tags.join('.*');
        command += ` --mochaOpts.grep "${tagPattern}"`;
      }
    } else {
      // Run full suite
      command = `npx wdio ${configFile}`;
      
      // Add tag filtering if tags are selected
      if (config.tags && config.tags.length > 0) {
        const tagPattern = config.tags.join('.*');
        command += ` --mochaOpts.grep "${tagPattern}"`;
      }
    }
    
    // Load existing running tests
    const runningTests = await loadRunningTests();
    
    // Store test metadata
    runningTests.set(runId, {
      id: runId,
      name: config.testMode === 'single' && config.test 
        ? `Single: ${config.test.split('/').pop()}`
        : `Full Test Suite${config.tags && config.tags.length > 0 ? ` (${config.tags.join(', ')})` : ''}`,
      config,
      status: 'RUNNING',
      created: new Date().toISOString(),
      startTime: new Date().toISOString(),
      device: config.device,
      platform: config.platform,
      build: config.build,
      command,
      // Test execution details
      tags: config.tags,
      testMode: config.testMode,
      selectedTest: config.test,
      selectedTestCase: config.testCase,
      executingTests: await getExpectedTests(config), // Pre-populate based on selection
      currentlyRunningTest: null
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
        // Parse final output for test names
        await parseTestOutput(runId, stdout);
        
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
        // Parse output even on failure for test names
        if (error.stdout) {
          await parseTestOutput(runId, error.stdout);
        }
        
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
  } catch (error) {
    console.error('Failed to start test:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
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