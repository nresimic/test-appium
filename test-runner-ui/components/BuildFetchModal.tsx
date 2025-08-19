'use client';

import { useState, useEffect } from 'react';
import { X, Download, Loader2, Smartphone, GitBranch, CheckCircle, Package } from 'lucide-react';

interface BuildFetchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onDownloadStart?: (message: string) => void;
}

interface BuildConfig {
  buildNumber: number;
  buildSlug: string;
  workflow: string;
  commitMessage: string;
  triggeredAt: string;
}

type Platform = 'android' | 'ios';
type Step = 'platform' | 'branch' | 'build' | 'confirm' | 'downloading';

export default function BuildFetchModal({ isOpen, onClose, onSuccess, onError, onDownloadStart }: BuildFetchModalProps) {
  const [step, setStep] = useState<Step>('platform');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('android');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedBuild, setSelectedBuild] = useState<BuildConfig | null>(null);
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);
  const [availableBuilds, setAvailableBuilds] = useState<BuildConfig[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingBuilds, setLoadingBuilds] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('platform');
      setSelectedPlatform('android');
      setSelectedBranch('');
      setAvailableBranches([]);
      setLoadingBranches(false);
      setDownloading(false);
    }
  }, [isOpen]);

  const fetchBranches = async (platform: Platform) => {
    setLoadingBranches(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/bitrise/branches`);
      const data = await response.json();
      if (data.success && data.branches) {
        setAvailableBranches(data.branches);
        setSelectedBranch(data.branches[0] || '');
      } else {
        onError('Failed to fetch branches from Bitrise');
      }
    } catch (error) {
      console.error('Failed to fetch branches:', error);
      onError('Failed to connect to Bitrise API');
    } finally {
      setLoadingBranches(false);
    }
  };

  const handlePlatformSelect = async (platform: Platform) => {
    setSelectedPlatform(platform);
    setStep('branch');
    await fetchBranches(platform);
  };

  const handleBranchSelect = async (branch: string) => {
    setSelectedBranch(branch);
    setStep('build');
    await fetchBuilds(branch);
  };

  const fetchBuilds = async (branch: string) => {
    setLoadingBuilds(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/bitrise/builds?branch=${encodeURIComponent(branch)}`);
      const data = await response.json();
      if (data.success && data.builds) {
        const builds = data.builds.map((build: any) => ({
          buildNumber: build.buildNumber,
          buildSlug: build.buildSlug,
          workflow: build.workflow || 'default',
          commitMessage: build.commitMessage || '',
          triggeredAt: build.triggeredAt
        }));
        setAvailableBuilds(builds);
        if (builds.length > 0) {
          setSelectedBuild(builds[0]);
        }
      } else {
        onError('Failed to fetch builds for this branch');
      }
    } catch (error) {
      console.error('Failed to fetch builds:', error);
      onError('Failed to connect to Bitrise API for builds');
    } finally {
      setLoadingBuilds(false);
    }
  };

  const handleBuildSelect = (build: BuildConfig) => {
    setSelectedBuild(build);
    setStep('confirm');
  };

  const handleDownload = async () => {
    // Close modal immediately and start background download
    onClose();
    
    // Show initial progress notification and start progress indicator
    const buildName = `${selectedBuild?.workflow} #${selectedBuild?.buildNumber}`;
    const downloadMessage = `Downloading ${selectedPlatform} ${buildName}...`;
    onDownloadStart?.(downloadMessage);
    
    try {
      // Start background download (don't await)
      fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/builds/fetch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          platform: selectedPlatform,
          branch: selectedBranch,
          buildSlug: selectedBuild?.buildSlug,
          background: true
        })
      }).then(async (response) => {
        const data = await response.json();
        
        if (data.success) {
          // Show success notification
          setTimeout(() => {
            onSuccess(`✅ Successfully downloaded ${selectedPlatform} ${buildName} and updated config!`);
          }, 1000); // Small delay to let initial notification show
        } else {
          setTimeout(() => {
            onError(`❌ Failed to download ${buildName}: ${data.error || 'Unknown error'}`);
          }, 1000);
        }
      }).catch((error) => {
        console.error('Background download failed:', error);
        setTimeout(() => {
          onError(`❌ Failed to download ${buildName}: Network error`);
        }, 1000);
      });
      
    } catch (error) {
      console.error('Failed to start download:', error);
      onError('Failed to start build download');
    }
  };

  const handleBack = () => {
    switch (step) {
      case 'branch':
        setStep('platform');
        break;
      case 'build':
        setStep('branch');
        break;
      case 'confirm':
        setStep('build');
        break;
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 'platform': return 'Select Platform';
      case 'branch': return 'Select Branch';
      case 'build': return 'Select Build';
      case 'confirm': return 'Confirm Download';
      case 'downloading': return 'Downloading Build';
    }
  };

  const getStepNumber = () => {
    switch (step) {
      case 'platform': return 1;
      case 'branch': return 2;
      case 'build': return 3;
      case 'confirm': return 4;
      case 'downloading': return 4;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 animate-in fade-in-0 duration-300 ease-out">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-in zoom-in-95 slide-in-from-bottom-2 duration-400 ease-out">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{getStepTitle()}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-500">Step {getStepNumber()} of 4</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((num) => (
                  <div
                    key={num}
                    className={`w-2 h-2 rounded-full ${
                      num <= getStepNumber() ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={downloading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Platform Selection */}
          {step === 'platform' && (
            <div className="space-y-4">
              <p className="text-gray-600 text-sm">Choose the platform for the build you want to fetch:</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handlePlatformSelect('android')}
                  className="flex flex-col items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all"
                >
                  <Smartphone className="w-8 h-8 text-green-600" />
                  <span className="font-medium">Android</span>
                  <span className="text-xs text-gray-500">APK Build</span>
                </button>
                <button
                  onClick={() => handlePlatformSelect('ios')}
                  className="flex flex-col items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all"
                >
                  <Smartphone className="w-8 h-8 text-blue-600" />
                  <span className="font-medium">iOS</span>
                  <span className="text-xs text-gray-500">IPA Build</span>
                </button>
              </div>
            </div>
          )}

          {/* Branch Selection */}
          {step === 'branch' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Smartphone className="w-4 h-4" />
                <span>Platform: <span className="font-medium capitalize">{selectedPlatform}</span></span>
              </div>
              
              {loadingBranches ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                  <p className="text-gray-600">Fetching branches from Bitrise...</p>
                </div>
              ) : (
                <>
                  <p className="text-gray-600 text-sm">Select the branch to fetch the latest build from:</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {availableBranches.map((branch) => (
                      <button
                        key={branch}
                        onClick={() => handleBranchSelect(branch)}
                        className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                      >
                        <GitBranch className="w-4 h-4 text-gray-500" />
                        <span className="font-mono text-sm">{branch}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Build Selection */}
          {step === 'build' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Smartphone className="w-4 h-4" />
                <span>Platform: <span className="font-medium capitalize">{selectedPlatform}</span></span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <GitBranch className="w-4 h-4" />
                <span>Branch: <span className="font-mono font-medium">{selectedBranch}</span></span>
              </div>
              
              {loadingBuilds ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                  <p className="text-gray-600">Fetching available builds...</p>
                </div>
              ) : (
                <>
                  <p className="text-gray-600 text-sm">Select the build configuration to download:</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {availableBuilds.map((build, index) => (
                      <button
                        key={build.buildSlug}
                        onClick={() => handleBuildSelect(build)}
                        className={`w-full flex items-start gap-3 p-3 border rounded-lg text-left transition-all ${
                          selectedBuild?.buildSlug === build.buildSlug
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                        }`}
                      >
                        <Package className="w-4 h-4 text-gray-500 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">#{build.buildNumber}</span>
                            <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">
                              {build.workflow}
                            </span>
                          </div>
                          {build.commitMessage && (
                            <p className="text-xs text-gray-600 line-clamp-2">
                              {build.commitMessage.substring(0, 60)}
                              {build.commitMessage.length > 60 ? '...' : ''}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(build.triggeredAt).toLocaleDateString()} at {new Date(build.triggeredAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Confirm Download */}
          {step === 'confirm' && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h3 className="font-medium text-gray-900">Build Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-gray-500" />
                    <span>Platform: <span className="font-medium capitalize">{selectedPlatform}</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-gray-500" />
                    <span>Branch: <span className="font-mono font-medium">{selectedBranch}</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-gray-500" />
                    <span>Build: <span className="font-medium">#{selectedBuild?.buildNumber} ({selectedBuild?.workflow})</span></span>
                  </div>
                </div>
              </div>
              
              <p className="text-gray-600 text-sm">
                This will download the selected build and make it available for testing.
              </p>
            </div>
          )}

          {/* Downloading */}
          {step === 'downloading' && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
              <h3 className="font-medium text-gray-900 mb-2">Downloading Build</h3>
              <p className="text-gray-600 text-sm text-center">
                Fetching latest {selectedPlatform} build from {selectedBranch}...
                <br />
                This may take a few minutes.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'downloading' && (
          <div className="flex items-center justify-between p-6 border-t border-gray-200">
            <button
              onClick={step === 'platform' ? onClose : handleBack}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              {step === 'platform' ? 'Cancel' : 'Back'}
            </button>
            
            {step === 'confirm' && (
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Build
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}