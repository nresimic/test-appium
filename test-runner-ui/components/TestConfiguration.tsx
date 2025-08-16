'use client';

import { useState, useEffect } from 'react';
import { Play, Smartphone, Package, FileCode, RefreshCw, Download } from 'lucide-react';
import { useToast } from './ToastContainer';

interface Build {
  id: string;
  filename: string;
  version: string;
  platform: 'ios' | 'android';
  size: number;
  created: string;
  path: string;
}

interface TestFile {
  path: string;
  name: string;
  tests: string[];
}

interface DeviceFarmDevice {
  id: string;
  name: string;
  model: string;
  os: string;
  osVersion: string;
  manufacturer: string;
  formFactor: string;
  availability: string;
}

interface TestConfigurationProps {
  onTestStart: (runId: string) => void;
}

export default function TestConfiguration({ onTestStart }: TestConfigurationProps) {
  const { showToast } = useToast();
  const [platform, setPlatform] = useState<'ios' | 'android'>('android');
  const [selectedBuild, setSelectedBuild] = useState<string>('');
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [testMode, setTestMode] = useState<'full' | 'single'>('full');
  const [selectedTest, setSelectedTest] = useState<string>('');
  const [selectedTestCase, setSelectedTestCase] = useState<string>('');
  const [runLocation, setRunLocation] = useState<'local' | 'device-farm'>('local');
  
  const [builds, setBuilds] = useState<Build[]>([]);
  const [testFiles, setTestFiles] = useState<TestFile[]>([]);
  const [deviceFarmDevices, setDeviceFarmDevices] = useState<DeviceFarmDevice[]>([]);
  const [loadingBuilds, setLoadingBuilds] = useState(false);
  const [loadingTests, setLoadingTests] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [fetchingBuilds, setFetchingBuilds] = useState(false);
  const [submittingDeviceFarm, setSubmittingDeviceFarm] = useState(false);
  
  // Tag selection state
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const availableTags = ['@smoke', '@regression', '@critical', '@auth', '@banking', '@portfolio', '@settings'];

  useEffect(() => {
    fetchTestFiles();
  }, []);

  useEffect(() => {
    fetchBuilds();
    if (runLocation === 'device-farm') {
      fetchDeviceFarmDevices();
    }
  }, [platform, runLocation]);

  // Auto-select @ios tag when iOS platform is selected
  useEffect(() => {
    if (platform === 'ios') {
      if (!selectedTags.includes('@ios')) {
        setSelectedTags(prev => [...prev, '@ios']);
      }
    } else {
      // Remove @ios tag when switching to Android
      setSelectedTags(prev => prev.filter(tag => tag !== '@ios'));
    }
  }, [platform]);

  const fetchTestFiles = async () => {
    setLoadingTests(true);
    try {
      const response = await fetch('/api/tests');
      const data = await response.json();
      setTestFiles(data.testFiles || []);
    } catch (error) {
      console.error('Failed to fetch test files:', error);
    } finally {
      setLoadingTests(false);
    }
  };

  const fetchBuilds = async () => {
    setLoadingBuilds(true);
    try {
      const response = await fetch('/api/builds');
      const data = await response.json();
      const filteredBuilds = data.builds?.filter((b: Build) => b.platform === platform) || [];
      setBuilds(filteredBuilds);
      setSelectedBuild('');
    } catch (error) {
      console.error('Failed to fetch builds:', error);
    } finally {
      setLoadingBuilds(false);
    }
  };

  const fetchLatestBuilds = async () => {
    setFetchingBuilds(true);
    try {
      const response = await fetch('/api/builds/fetch', { method: 'POST' });
      if (response.ok) {
        await fetchBuilds();
      }
    } catch (error) {
      console.error('Failed to fetch latest builds:', error);
    } finally {
      setFetchingBuilds(false);
    }
  };

  const fetchDeviceFarmDevices = async () => {
    setLoadingDevices(true);
    try {
      const response = await fetch(`/api/device-farm/devices?platform=${platform}`);
      const data = await response.json();
      console.log('Device Farm API response:', data);
      console.log('Number of devices received:', data.devices?.length || 0);
      console.log('First few devices:', data.devices?.slice(0, 5));
      setDeviceFarmDevices(data.devices || []);
      setSelectedDevice(''); // Reset device selection when devices change
    } catch (error) {
      console.error('Failed to fetch Device Farm devices:', error);
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleRunTest = async () => {
    const config = {
      platform,
      build: selectedBuild,
      device: selectedDevice,
      testMode,
      test: testMode === 'single' ? selectedTest : undefined,
      testCase: testMode === 'single' ? selectedTestCase : undefined,
      runLocation,
      tags: selectedTags
    };
    
    console.log('Running test with config:', config);
    
    try {
      if (runLocation === 'device-farm') {
        // Prevent multiple submissions
        if (submittingDeviceFarm) {
          showToast('warning', 'Submission in Progress', 'Please wait for the current Device Farm submission to complete');
          return;
        }
        
        setSubmittingDeviceFarm(true);
        showToast('info', 'Submitting to Device Farm', 'Uploading test package and scheduling run...');
        
        // Use real Device Farm API
        const useMock = false; // Set to true only for testing without AWS
        
        if (useMock) {
          // Mock Device Farm test
          const response = await fetch('/api/device-farm/mock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
          });
          
          if (response.ok) {
            const data = await response.json();
            showToast('info', 'Mock Device Farm Test Started', 
              `Run ID: ${data.runId}\nStatus: ${data.status}\nDevices: ${data.devices.map((d: any) => d.name).join(', ')}`);
            
            // Poll for mock status
            const pollStatus = async () => {
              const statusResponse = await fetch(`/api/device-farm/mock?runId=${data.runId}`);
              const statusData = await statusResponse.json();
              console.log(`[Device Farm Mock] Progress: ${statusData.progress}%`, statusData);
              
              if (statusData.status !== 'COMPLETED') {
                setTimeout(pollStatus, 5000);
              } else {
                console.log('[Device Farm Mock] Test completed!', statusData);
                showToast('success', 'Mock Test Completed', 
                  `Result: ${statusData.result} - Passed: ${statusData.counters.passed}/${statusData.counters.total}`);
              }
            };
            
            setTimeout(pollStatus, 5000);
          }
        } else {
          // Real Device Farm integration
          if (!selectedBuildInfo?.path) {
            showToast('warning', 'Build Required', 'Please select a build file first');
            return;
          }
          
          if (!selectedDevice) {
            showToast('warning', 'Device Required', 'Please select a device first');
            return;
          }
          
          // Create device pool for selected device if using Device Farm
          let devicePoolArn = '';
          if (runLocation === 'device-farm') {
            try {
              console.log('Creating device pool for selected device...');
              const devicePoolResponse = await fetch('/api/device-farm/devices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  deviceArn: selectedDevice,
                  platform
                })
              });
              
              if (!devicePoolResponse.ok) {
                const error = await devicePoolResponse.json();
                throw new Error(error.error || 'Failed to create device pool');
              }
              
              const devicePoolData = await devicePoolResponse.json();
              devicePoolArn = devicePoolData.devicePoolArn;
              console.log('Device pool created:', devicePoolArn);
            } catch (error: any) {
              console.error('Failed to create device pool:', error);
              showToast('error', 'Failed to create device pool', error.message || 'Unknown error');
              return;
            }
          } else {
            // Use default device pool for backward compatibility
            devicePoolArn = platform === 'android' 
              ? 'arn:aws:devicefarm:us-west-2:859998284317:devicepool:9a2e2485-4bd8-4b1a-af28-254326345350/a2abb9be-9849-48fa-9cc2-0d56897b8772'
              : process.env.NEXT_PUBLIC_DEVICE_FARM_IOS_POOL_ARN || '';
          }
          
          const deviceFarmConfig = {
            projectArn: process.env.NEXT_PUBLIC_DEVICE_FARM_PROJECT_ARN || 'arn:aws:devicefarm:us-west-2:859998284317:project:9a2e2485-4bd8-4b1a-af28-254326345350',
            devicePoolArn,
            platform,
            buildPath: selectedBuildInfo.path,
            testSpecPath: 'device-farm-testspec.yml',
            testMode,
            test: testMode === 'single' ? selectedTest : undefined,
            testCase: testMode === 'single' ? selectedTestCase : undefined
          };
          
          // Call the Device Farm API
          const response = await fetch('/api/device-farm/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(deviceFarmConfig)
          });
          
          if (response.ok) {
            const data = await response.json();
            showToast('success', 'Device Farm Test Scheduled!', 
              `Status: ${data.status} - The test will run on real devices in AWS.`);
            
            // You can poll the status or check in AWS Console
            console.log('Device Farm test started:', data);
          } else {
            const error = await response.json();
            showToast('error', 'Failed to start Device Farm test', 
              `${error.error} - Make sure your AWS credentials are configured in .env.local`);
          }
        }
        
        setSubmittingDeviceFarm(false);
        return;
      }
      
      // Local test execution
      const response = await fetch('/api/test/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      if (response.ok) {
        const { runId } = await response.json();
        onTestStart(runId);
      } else {
        console.error('Failed to start test');
        showToast('error', 'Failed to start test', 'Check console for details');
      }
    } catch (error) {
      console.error('Error starting test:', error);
      showToast('error', 'Error starting test', 'Make sure the device is booted');
      setSubmittingDeviceFarm(false); // Reset state on error
    }
  };

  const selectedTestFile = testFiles.find(f => f.path === selectedTest);
  const selectedBuildInfo = builds.find(b => b.id === selectedBuild);
  const selectedDeviceInfo = runLocation === 'device-farm' 
    ? deviceFarmDevices.find(d => d.id === selectedDevice)
    : null;

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-5">
      <h2 className="text-base font-semibold mb-4 text-gray-800">Configure Test Run</h2>
      
      <div className="space-y-4">
        {/* Run Location Selection */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">Run Location</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setRunLocation('local')}
              className={`py-2 px-3 rounded-md text-sm font-medium transition-all ${
                runLocation === 'local'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Local Device
            </button>
            <button
              onClick={() => setRunLocation('device-farm')}
              className={`py-2 px-3 rounded-md text-sm font-medium transition-all ${
                runLocation === 'device-farm'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              AWS Device Farm
            </button>
          </div>
        </div>

        {/* Platform Selection */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">Platform</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPlatform('android')}
              className={`py-2 px-3 rounded-md text-sm font-medium transition-all ${
                platform === 'android'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 inline mr-1" />
              Android
            </button>
            <button
              onClick={() => setPlatform('ios')}
              className={`py-2 px-3 rounded-md text-sm font-medium transition-all ${
                platform === 'ios'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 inline mr-1" />
              iOS
            </button>
          </div>
        </div>

        {/* Build Selection */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-medium text-gray-700">
              <Package className="w-3.5 h-3.5 inline mr-1" />
              Build
            </label>
            <button
              onClick={fetchLatestBuilds}
              disabled={fetchingBuilds}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              {fetchingBuilds ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Download className="w-3 h-3" />
              )}
              Fetch Latest
            </button>
          </div>
          <select
            value={selectedBuild}
            onChange={(e) => setSelectedBuild(e.target.value)}
            disabled={loadingBuilds}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">
              {loadingBuilds ? 'Loading...' : `Select build (${builds.length} available)`}
            </option>
            {builds.map(build => (
              <option key={build.id} value={build.id}>
                {build.filename} - {formatFileSize(build.size)}
              </option>
            ))}
          </select>
        </div>

        {/* Device Selection */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            <Smartphone className="w-3.5 h-3.5 inline mr-1" />
            Device {runLocation === 'device-farm' && '(AWS Device Farm)'}
          </label>
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            disabled={loadingDevices}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">
              {loadingDevices ? 'Loading devices...' : 'Select device...'}
            </option>
            {runLocation === 'device-farm' ? (
              // Device Farm devices
              deviceFarmDevices.map(device => (
                <option key={device.id} value={device.id}>
                  {device.manufacturer} {device.name} - {device.os} {device.osVersion}
                </option>
              ))
            ) : (
              // Local devices (fallback to hardcoded list)
              <>
                {platform === 'android' && (
                  <>
                    <option value="samsung_s21">Samsung Galaxy S21 - Android 13</option>
                    <option value="pixel_7">Google Pixel 7 - Android 13</option>
                    <option value="pixel_6">Google Pixel 6 - Android 12</option>
                  </>
                )}
                {platform === 'ios' && (
                  <>
                    <option value="iphone_14">iPhone 14 - iOS 16</option>
                    <option value="iphone_13">iPhone 13 - iOS 15</option>
                    <option value="iphone_12">iPhone 12 - iOS 14</option>
                  </>
                )}
              </>
            )}
          </select>
          {runLocation === 'device-farm' && (
            <div className="text-xs text-gray-500 mt-1">
              {loadingDevices ? 'Loading available devices...' : `${deviceFarmDevices.length} devices available`}
            </div>
          )}
        </div>

        {/* Test Mode Selection */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">Test Mode</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTestMode('full')}
              className={`py-2 px-3 rounded-md text-sm font-medium transition-all ${
                testMode === 'full'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Full Suite
            </button>
            <button
              onClick={() => setTestMode('single')}
              className={`py-2 px-3 rounded-md text-sm font-medium transition-all ${
                testMode === 'single'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Single Test
            </button>
          </div>
        </div>

        {/* Tag Selection */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Test Tags {platform === 'ios' && <span className="text-blue-600">(@ios required)</span>}
          </label>
          <div className="flex flex-wrap gap-2">
            {/* iOS tag - always visible when iOS platform */}
            {platform === 'ios' && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                @ios (required)
              </span>
            )}
            
            {/* Other available tags */}
            {availableTags.map(tag => (
              <button
                key={tag}
                onClick={() => {
                  if (selectedTags.includes(tag)) {
                    setSelectedTags(prev => prev.filter(t => t !== tag));
                  } else {
                    setSelectedTags(prev => [...prev, tag]);
                  }
                }}
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                  selectedTags.includes(tag)
                    ? 'bg-green-100 text-green-800 border border-green-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {selectedTags.length > 0 ? (
              <>Selected: {selectedTags.join(', ')}</>
            ) : (
              'Select tags to filter tests, or run all tests'
            )}
          </div>
        </div>

        {/* Single Test Selection */}
        {testMode === 'single' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                <FileCode className="w-3.5 h-3.5 inline mr-1" />
                Test File
              </label>
              <select
                value={selectedTest}
                onChange={(e) => {
                  setSelectedTest(e.target.value);
                  setSelectedTestCase('');
                }}
                disabled={loadingTests}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">
                  {loadingTests ? 'Loading...' : `Select test (${testFiles.length} files)`}
                </option>
                {testFiles.map(file => (
                  <option key={file.path} value={file.path}>
                    {file.name} ({file.tests.length} tests)
                  </option>
                ))}
              </select>
            </div>

            {selectedTest && selectedTestFile && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Test Case</label>
                <select
                  value={selectedTestCase}
                  onChange={(e) => setSelectedTestCase(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">All tests in file</option>
                  {selectedTestFile.tests.map(test => (
                    <option key={test} value={test}>
                      {test}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        {/* Configuration Summary */}
        {selectedBuild && selectedDevice && (
          <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
            <h3 className="text-xs font-semibold text-gray-700 mb-2">Configuration Summary</h3>
            <div className="text-xs text-gray-600 space-y-1">
              <p>• Platform: <span className="font-medium">{platform.toUpperCase()}</span></p>
              <p>• Build: <span className="font-medium">{selectedBuildInfo?.filename}</span></p>
              <p>• Location: <span className="font-medium">{runLocation === 'device-farm' ? 'AWS Device Farm' : 'Local Device'}</span></p>
              <p>• Device: <span className="font-medium">
                {runLocation === 'device-farm' && selectedDeviceInfo 
                  ? `${selectedDeviceInfo.manufacturer} ${selectedDeviceInfo.name} (${selectedDeviceInfo.os} ${selectedDeviceInfo.osVersion})`
                  : runLocation === 'local' 
                    ? selectedDevice 
                    : 'Unknown'
                }
              </span></p>
              <p>• Mode: <span className="font-medium">{testMode === 'full' ? 'Full Suite' : 'Single Test'}</span></p>
              {testMode === 'single' && selectedTest && (
                <>
                  <p>• Test: <span className="font-medium">{selectedTestFile?.name}</span></p>
                  {selectedTestCase && <p>• Case: <span className="font-medium">{selectedTestCase}</span></p>}
                </>
              )}
            </div>
          </div>
        )}

        {/* Run Button */}
        <button
          onClick={handleRunTest}
          disabled={!selectedBuild || !selectedDevice || (testMode === 'single' && !selectedTest) || (runLocation === 'device-farm' && submittingDeviceFarm)}
          className={`w-full py-2.5 px-4 rounded-md font-medium text-sm flex items-center justify-center gap-2 transition-all ${
            selectedBuild && selectedDevice && (testMode === 'full' || selectedTest) && !(runLocation === 'device-farm' && submittingDeviceFarm)
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {runLocation === 'device-farm' && submittingDeviceFarm ? (
            <>
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
              Submitting to AWS...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Test
            </>
          )}
        </button>
      </div>
    </div>
  );
}