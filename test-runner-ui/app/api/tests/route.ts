import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

interface TestFile {
  path: string;
  name: string;
  tests: string[];
}

async function extractTestsFromFile(filePath: string): Promise<string[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    // Extract test names from it() and it.only() blocks
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

async function findTestFiles(dir: string): Promise<TestFile[]> {
  const testFiles: TestFile[] = [];
  
  async function scanDirectory(currentDir: string) {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await scanDirectory(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.e2e.ts')) {
          // Calculate relative path from the main project root, not test-runner-ui
          const projectRoot = path.join(process.cwd(), '..');
          const relativePath = path.relative(projectRoot, fullPath);
          const tests = await extractTestsFromFile(fullPath);
          
          if (tests.length > 0) {
            testFiles.push({
              path: relativePath,
              name: entry.name.replace('.e2e.ts', '').replace(/-/g, ' ').replace(/_/g, ' ')
                .split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
              tests
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${currentDir}:`, error);
    }
  }
  
  await scanDirectory(dir);
  return testFiles;
}

export async function GET() {
  try {
    // Go up one level from test-runner-ui to main project
    const projectRoot = path.join(process.cwd(), '..');
    const testDir = path.join(projectRoot, 'test', 'e2e');
    
    const testFiles = await findTestFiles(testDir);
    
    return NextResponse.json({ testFiles });
  } catch (error) {
    console.error('Error fetching test files:', error);
    return NextResponse.json({ error: 'Failed to fetch test files' }, { status: 500 });
  }
}