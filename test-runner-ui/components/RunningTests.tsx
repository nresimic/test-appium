'use client';

import { useState, useEffect } from 'react';
import { 
  Loader2, 
  Clock, 
  Smartphone, 
  Package,
  Cloud,
  Monitor,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface RunningTest {
  id: string;
  name: string;
  status: 'RUNNING' | 'PENDING' | 'SCHEDULING';
  created: string;
  device: string;
  platform: 'ios' | 'android';
  build: string;
  runArn?: string;
  isDeviceFarm?: boolean;
  progress?: number;
  currentStep?: string;
  elapsedTime?: number;
  tags?: string[];
  testMode?: 'full' | 'single';
  selectedTest?: string;
  selectedTestCase?: string;
  executingTests?: string[];
  currentlyRunningTest?: string;
}

export default function RunningTests() {
  const [runningTests, setRunningTests] = useState<RunningTest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRunningTests();
    // Refresh every 3 seconds for more real-time updates
    const interval = setInterval(() => {
      fetchRunningTests();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchRunningTests = async () => {
    try {
      // Fetch local tests, Device Farm running tests, and history
      const [localResponse, deviceFarmResponse, historyResponse] = await Promise.all([
        fetch('/api/test/run'), // Gets all running local tests
        fetch('/api/device-farm/running'), // Gets current running Device Farm tests
        fetch('/api/test/history') // Gets history including running Device Farm tests
      ]);

      // Check if responses are OK and content type is JSON
      const localData = localResponse.ok && localResponse.headers.get('content-type')?.includes('application/json') 
        ? await localResponse.json() 
        : { tests: [] };
      
      const deviceFarmData = deviceFarmResponse.ok && deviceFarmResponse.headers.get('content-type')?.includes('application/json')
        ? await deviceFarmResponse.json()
        : { runningTests: [] };
      
      const historyData = historyResponse.ok && historyResponse.headers.get('content-type')?.includes('application/json')
        ? await historyResponse.json()
        : { history: [] };

      // Filter for running tests only
      const runningLocal = localData.tests?.filter((t: any) => 
        t.status === 'RUNNING' || t.status === 'PENDING'
      ) || [];

      // Get Device Farm running tests (prioritize direct API call over history)
      const runningDeviceFarm = deviceFarmData.runningTests || 
        historyData.history?.filter((h: any) => 
          (h.status === 'RUNNING' || h.status === 'PENDING' || h.status === 'SCHEDULING') && h.isDeviceFarm
        ) || [];

      // Calculate elapsed time for each test
      const now = Date.now();
      const testsWithElapsedTime = [...runningLocal, ...runningDeviceFarm].map(test => ({
        ...test,
        elapsedTime: test.created ? 
          Math.floor((now - new Date(test.created).getTime()) / 1000) : 0
      }));

      setRunningTests(testsWithElapsedTime);
      
      // Debug logging
      if (process.env.NODE_ENV === 'development') {
        console.log('Running tests update:', {
          local: runningLocal.length,
          deviceFarm: runningDeviceFarm.length,
          total: testsWithElapsedTime.length
        });
      }
    } catch (error) {
      console.error('Failed to fetch running tests:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatElapsedTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'PENDING':
      case 'SCHEDULING':
        return <Clock className="w-5 h-5 text-yellow-500 animate-pulse" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getProgressBar = (test: RunningTest) => {
    // Estimate progress based on elapsed time (assume 5 minutes max)
    const estimatedProgress = Math.min(95, (test.elapsedTime || 0) / 3); // ~3 seconds per percent
    const progress = test.progress || estimatedProgress;

    return (
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500 animate-pulse"
          style={{ width: `${progress}%` }}
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="glass rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-cyan-50">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">Running Tests</h2>
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
              <span className="text-sm text-gray-600">Loading...</span>
            </div>
          </div>
        </div>
        
        <div className="p-8">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="relative">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
              <div className="absolute inset-0 w-12 h-12 border-2 border-blue-100 rounded-full"></div>
            </div>
            <p className="text-gray-600 text-lg mt-4 font-medium">Checking for running tests...</p>
            <p className="text-gray-400 text-sm mt-2">This usually takes just a moment</p>
          </div>
        </div>
      </div>
    );
  }

  if (runningTests.length === 0) {
    return (
      <div className="glass rounded-2xl shadow-xl p-8">
        <h2 className="text-xl font-bold text-gray-800 mb-6">Running Tests</h2>
        <div className="text-center py-12">
          <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No tests currently running</p>
          <p className="text-gray-400 text-sm mt-2">Start a new test from the Run Test tab</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl shadow-xl overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-cyan-50">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">Running Tests</h2>
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
            <span className="text-sm text-gray-600">{runningTests.length} active</span>
          </div>
        </div>
      </div>

      <div className="divide-y">
        {runningTests.map(test => (
          <div key={test.id} className="p-6 hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-cyan-50/30 transition-all">
            <div className="flex items-start gap-4">
              {getStatusIcon(test.status)}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-medium text-gray-900">{test.name}</h3>
                  {test.isDeviceFarm ? (
                    <span className="text-xs px-2 py-1 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-full flex items-center gap-1">
                      <Cloud className="w-3 h-3" />
                      AWS Device Farm
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full flex items-center gap-1">
                      <Monitor className="w-3 h-3" />
                      Local
                    </span>
                  )}
                  <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">
                    {test.status}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatElapsedTime(test.elapsedTime || 0)} elapsed
                  </span>
                  <span className="flex items-center gap-1">
                    <Smartphone className="w-3 h-3" />
                    {test.device}
                  </span>
                  <span className="flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    {test.build}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mb-2">
                  {getProgressBar(test)}
                </div>

                {/* Current Step */}
                {test.currentStep && (
                  <p className="text-xs text-gray-500">
                    Current: {test.currentStep}
                  </p>
                )}

                {/* Test Execution Details */}
                <div className="mt-3 space-y-2">
                  {/* Test Mode and Selection */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                      {test.testMode === 'single' ? 'Single Test' : 'Full Suite'}
                    </span>
                    
                    {test.tags && test.tags.length > 0 && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                        Tags: {test.tags.join(', ')}
                      </span>
                    )}
                  </div>

                  {/* Selected Test File */}
                  {test.selectedTest && (
                    <p className="text-xs text-gray-600">
                      <span className="font-medium">Test File:</span> {test.selectedTest.split('/').pop()}
                    </p>
                  )}

                  {/* Selected Test Case */}
                  {test.selectedTestCase && (
                    <p className="text-xs text-gray-600">
                      <span className="font-medium">Test Case:</span> {test.selectedTestCase}
                    </p>
                  )}

                  {/* Currently Running Test */}
                  {test.currentlyRunningTest && (
                    <div className="p-2 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-xs text-yellow-800">
                        <span className="font-medium">Currently Executing:</span> {test.currentlyRunningTest}
                      </p>
                    </div>
                  )}

                  {/* List of Executing Tests */}
                  {test.executingTests && test.executingTests.length > 0 && (
                    <div className="border border-gray-200 rounded p-2">
                      <p className="text-xs font-medium text-gray-700 mb-1">Tests in this run:</p>
                      <div className="max-h-20 overflow-y-auto">
                        {test.executingTests.map((testTitle, index) => (
                          <div key={index} className="text-xs text-gray-600 py-0.5 flex items-center gap-1">
                            <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                            {testTitle}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Test ID */}
                <p className="text-xs text-gray-400 mt-2">
                  ID: {test.id}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}