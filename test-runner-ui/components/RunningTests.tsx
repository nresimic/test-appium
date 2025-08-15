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
      // Fetch from both local and Device Farm
      const [localResponse, historyResponse, deviceFarmResponse] = await Promise.all([
        fetch('/api/test/run'), // Gets all running local tests
        fetch('/api/test/history'), // Gets history including running Device Farm tests
        fetch('/api/device-farm/running') // Get running tests directly from Device Farm
      ]);

      // Check if responses are OK and content type is JSON
      const localData = localResponse.ok && localResponse.headers.get('content-type')?.includes('application/json') 
        ? await localResponse.json() 
        : { tests: [] };
      
      const historyData = historyResponse.ok && historyResponse.headers.get('content-type')?.includes('application/json')
        ? await historyResponse.json()
        : { history: [] };
      
      const deviceFarmData = deviceFarmResponse.ok && deviceFarmResponse.headers.get('content-type')?.includes('application/json')
        ? await deviceFarmResponse.json()
        : { runningTests: [] };

      // Filter for running tests only
      const runningLocal = localData.tests?.filter((t: any) => 
        t.status === 'RUNNING' || t.status === 'PENDING'
      ) || [];

      // Use Device Farm running tests directly, or fall back to history
      const runningDeviceFarm = deviceFarmData.runningTests || historyData.history?.filter((h: any) => 
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
      <div className="glass rounded-2xl shadow-xl p-8">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
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

                {/* Test ID */}
                <p className="text-xs text-gray-400 mt-1">
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