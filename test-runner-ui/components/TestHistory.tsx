'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useToast } from './ToastContainer';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Smartphone, 
  Package, 
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Cloud,
  Monitor,
  FileText,
  Loader2,
  BarChart2,
  RefreshCw
} from 'lucide-react';

interface TestRun {
  id: string;
  name: string;
  status: 'COMPLETED' | 'RUNNING' | 'PENDING';
  result?: 'PASSED' | 'FAILED' | 'ERRORED';
  created: string;
  duration?: number;
  device: string;
  platform: 'ios' | 'android';
  build: string;
  counters?: {
    passed: number;
    failed: number;
    broken?: number;
    skipped: number;
    total: number;
  };
  artifactsUrl?: string;
  runArn?: string;
  isDeviceFarm?: boolean;
  hasAllureReport?: boolean;
}

// Removed mock data - now using real API data

export default function TestHistory() {
  const { showToast } = useToast();
  const [history, setHistory] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReportId, setLoadingReportId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Initial load with sync
    fetchHistoryWithSync();
    
    // Refresh every 5 seconds - only fetch history, not Device Farm
    const interval = setInterval(() => {
      fetchHistoryOnly();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchHistoryWithSync = async () => {
    try {
      // First sync Device Farm data, then fetch history
      await syncDeviceFarmData();
      await fetchHistoryOnly();
    } catch (error) {
      console.error('Failed to fetch history with sync:', error);
      setLoading(false);
    }
  };

  const fetchHistoryOnly = async () => {
    try {
      const response = await fetch('/api/test/history');
      if (response.ok) {
        const data = await response.json();
        // Filter to only show completed tests in history
        const completedTests = (data.history || []).filter((test: TestRun) => 
          test.status === 'COMPLETED'
        );
        setHistory(completedTests);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncDeviceFarmData = async () => {
    try {
      const response = await fetch('/api/device-farm/sync');
      if (response.ok) {
        const data = await response.json();
        console.log('Device Farm sync:', data.message);
        return data;
      }
    } catch (error) {
      console.warn('Device Farm sync failed:', error);
      throw error;
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      showToast('info', 'Syncing...', 'Fetching latest data from AWS Device Farm...');
      const result = await syncDeviceFarmData();
      await fetchHistoryOnly();
      showToast('success', 'Sync Complete', result?.message || 'Device Farm data synchronized');
    } catch (error) {
      showToast('error', 'Sync Failed', 'Could not sync with AWS Device Farm');
    } finally {
      setSyncing(false);
    }
  };
  
  // Device Farm syncing should only happen when explicitly needed, not on every interval

  const getResultIcon = (result?: string) => {
    switch (result) {
      case 'PASSED':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'FAILED':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const calculatePassRate = () => {
    const completed = history.filter(run => run.status === 'COMPLETED');
    if (completed.length === 0) return 0;
    const passed = completed.filter(run => run.result === 'PASSED').length;
    return Math.round((passed / completed.length) * 100);
  };

  const passRate = calculatePassRate();
  const previousPassRate = 75; // Mock previous pass rate

  if (loading) {
    return (
      <div className="glass rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">Test History</h2>
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
              <span className="text-sm text-gray-600">Loading...</span>
            </div>
          </div>
        </div>
        
        <div className="p-8">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="relative">
              <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
              <div className="absolute inset-0 w-12 h-12 border-2 border-purple-100 rounded-full"></div>
            </div>
            <p className="text-gray-600 text-lg mt-4 font-medium">Loading test history...</p>
            <p className="text-gray-400 text-sm mt-2">Fetching completed test runs and syncing with AWS</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="glass rounded-xl shadow-lg p-5 hover:shadow-xl transition-shadow">
          <p className="text-sm text-gray-600 mb-1">Total Runs</p>
          <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{history.length}</p>
        </div>
        <div className="glass rounded-xl shadow-lg p-5 hover:shadow-xl transition-shadow">
          <p className="text-sm text-gray-600 mb-1">Pass Rate</p>
          <div className="flex items-center gap-2">
            <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">{passRate}%</p>
            {passRate > previousPassRate ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
          </div>
        </div>
        <div className="glass rounded-xl shadow-lg p-5 hover:shadow-xl transition-shadow">
          <p className="text-sm text-gray-600 mb-1">Last Run</p>
          <p className="text-lg font-medium">
            {history[0] && format(new Date(history[0].created), 'HH:mm')}
          </p>
        </div>
        <div className="glass rounded-xl shadow-lg p-5 hover:shadow-xl transition-shadow">
          <p className="text-sm text-gray-600 mb-1">Avg Duration</p>
          <p className="text-lg font-medium">
            {formatDuration(
              Math.round(
                history.reduce((acc, run) => acc + (run.duration || 0), 0) / history.length
              )
            )}
          </p>
        </div>
      </div>

      {/* Test Runs List */}
      <div className="glass rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">Completed Test Runs</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={handleManualSync}
                disabled={syncing}
                className={`flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg shadow-md hover:shadow-lg transition-all ${
                  syncing 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync AWS'}
              </button>
              <a
                href="/api/allure-report/index.html"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 rounded-lg shadow-md hover:shadow-lg transition-all"
              >
                <BarChart2 className="w-4 h-4" />
                View Full Report
              </a>
            </div>
          </div>
        </div>
        
        <div className="divide-y">
          {history.map(run => (
            <div key={run.id} className="p-6 hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-pink-50/50 transition-all">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  {getResultIcon(run.result)}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{run.name}</h3>
                      {/* Test location badge */}
                      {run.isDeviceFarm ? (
                        <span className="text-xs px-2 py-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-full flex items-center gap-1">
                          <Cloud className="w-3 h-3" />
                          AWS Device Farm
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full flex items-center gap-1">
                          <Monitor className="w-3 h-3" />
                          Local
                        </span>
                      )}
                      <span className="text-xs px-2 py-1 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full">
                        {run.id}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(run.created), 'MMM d, HH:mm')}
                      </span>
                      {run.duration && (
                        <span>{formatDuration(run.duration)}</span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <Smartphone className="w-3 h-3" />
                        {run.device}
                      </span>
                      <span className="flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {run.build}
                      </span>
                    </div>
                    
                    {run.counters && run.isDeviceFarm && (
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        {run.counters.passed > 0 && (
                          <span className="text-green-600">
                            ✓ {run.counters.passed} passed
                          </span>
                        )}
                        {run.counters.failed > 0 && (
                          <span className="text-red-600">
                            ✗ {run.counters.failed} failed
                          </span>
                        )}
                        {run.counters.broken && run.counters.broken > 0 && (
                          <span className="text-yellow-600">
                            ⚠ {run.counters.broken} broken
                          </span>
                        )}
                        {run.counters.skipped > 0 && (
                          <span className="text-gray-500">
                            ⊘ {run.counters.skipped} skipped
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Show appropriate report button based on test type */}
                {run.status === 'COMPLETED' && (
                  <>
                    {run.isDeviceFarm && run.runArn ? (
                      <div className="flex flex-col items-end gap-2">
                        <button
                          onClick={async () => {
                            setLoadingReportId(run.id);
                            showToast('info', 'Fetching Report', 'Checking AWS Device Farm for test report...');
                            
                            try {
                              const response = await fetch(`/api/device-farm/report?runArn=${encodeURIComponent(run.runArn!)}`);
                              const data = await response.json();
                              
                              if (data.hasReport && data.reportUrl) {
                                // Open report directly (S3 URL or Device Farm URL)
                                showToast('success', 'Opening Report', 'Your test report is opening in a new tab');
                                window.open(data.reportUrl, '_blank');
                              } else {
                                showToast('warning', 'No Report Available', 'The Allure report has not been generated yet for this test run');
                              }
                            } catch (error) {
                              console.error('Failed to fetch report:', error);
                              showToast('error', 'Failed to Fetch Report', 'Could not retrieve the test report. Please try again.');
                            } finally {
                              setLoadingReportId(null);
                            }
                          }}
                          disabled={loadingReportId === run.id}
                          className={`flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg shadow-md transition-all ${
                            loadingReportId === run.id 
                              ? 'bg-gray-400 cursor-not-allowed' 
                              : 'bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 hover:shadow-lg'
                          }`}
                        >
                          {loadingReportId === run.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Fetching Report...
                            </>
                          ) : (
                            <>
                              <FileText className="w-3 h-3" />
                              View Allure Report
                            </>
                          )}
                        </button>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Cloud className="w-3 h-3" />
                          AWS Device Farm Report
                        </span>
                      </div>
                    ) : (run.hasAllureReport || run.artifactsUrl) ? (
                      <div className="flex flex-col items-end gap-2">
                        <a
                          href={run.artifactsUrl || `/api/allure/report?runId=${run.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg shadow-md hover:shadow-lg transition-all"
                        >
                          <FileText className="w-3 h-3" />
                          View Allure Report
                        </a>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Monitor className="w-3 h-3" />
                          Local Test Report
                        </span>
                      </div>
                    ) : null}
                  </>
                )}
                
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}