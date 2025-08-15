import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Store history in a JSON file (in production, use a database)
const getHistoryPath = () => {
  return path.join(process.cwd(), 'test-history.json');
};

async function loadHistory() {
  try {
    const data = await fs.readFile(getHistoryPath(), 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveHistory(history: any[]) {
  await fs.writeFile(getHistoryPath(), JSON.stringify(history, null, 2));
}

export async function GET() {
  try {
    const history = await loadHistory();
    return NextResponse.json({ history });
  } catch (error) {
    console.error('Failed to load history:', error);
    return NextResponse.json({ history: [] });
  }
}

export async function POST(request: Request) {
  try {
    const testRun = await request.json();
    const history = await loadHistory();
    
    // Check if this is an update to an existing Device Farm run
    if (testRun.runArn) {
      const existingIndex = history.findIndex((h: any) => h.runArn === testRun.runArn);
      if (existingIndex !== -1) {
        // Update existing entry
        history[existingIndex] = {
          ...history[existingIndex],
          ...testRun
        };
        await saveHistory(history);
        return NextResponse.json({ success: true, updated: true });
      }
    }
    
    // Add new test run to history (preserve id if provided, otherwise generate)
    history.unshift({
      ...testRun,
      id: testRun.id || `run-${Date.now()}`,
      created: testRun.created || new Date().toISOString()
    });
    
    // Keep only last 50 runs
    if (history.length > 50) {
      history.splice(50);
    }
    
    await saveHistory(history);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to save history:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}