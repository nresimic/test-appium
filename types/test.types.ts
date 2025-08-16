export interface TestConfig {
  platform: 'ios' | 'android';
  build: string;
  device: string;
  testMode: 'full' | 'single';
  test?: string;
  testCase?: string;
  tags?: string[];
}

export interface TestCounters {
  passed: number;
  failed: number;
  broken: number;
  skipped: number;
  total: number;
}

export interface TestRun {
  id: string;
  name: string;
  config: TestConfig;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  result?: 'PASSED' | 'FAILED';
  created: string;
  startTime: string;
  endTime?: string;
  device: string;
  platform: string;
  build: string;
  command: string;
  tags?: string[];
  testMode: string;
  selectedTest?: string;
  selectedTestCase?: string;
  executingTests: string[];
  currentlyRunningTest: string | null;
  output?: string;
  error?: string;
}

export interface HistoryEntry {
  id: string;
  name: string;
  status: string;
  result?: string;
  created: string;
  duration: number;
  device: string;
  platform: string;
  build: string;
  counters: TestCounters;
  artifactsUrl: string | null;
  hasAllureReport: boolean;
  isDeviceFarm: boolean;
}

export interface TestStorageData {
  id: string;
  [key: string]: unknown;
}

export type TestStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';
export type TestResult = 'PASSED' | 'FAILED';
export type Platform = 'ios' | 'android';
export type TestMode = 'full' | 'single';