'use client';

import { useState, useEffect } from 'react';
import TestConfiguration from '@/components/TestConfiguration';
import TestHistory from '@/components/TestHistory';
import RunningTests from '@/components/RunningTests';
import { Zap, History, Loader2, Home as HomeIcon } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'run' | 'running' | 'history'>('run');

  // Load tab from URL or localStorage on mount
  useEffect(() => {
    const savedTab = localStorage.getItem('activeTab');
    if (savedTab === 'run' || savedTab === 'running' || savedTab === 'history') {
      setActiveTab(savedTab);
    }
  }, []);

  // Save tab selection
  const handleTabChange = (tab: 'run' | 'running' | 'history') => {
    setActiveTab(tab);
    localStorage.setItem('activeTab', tab);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header with Navigation */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between py-3">
            <button 
              onClick={() => handleTabChange('run')}
              className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors cursor-pointer flex items-center gap-2"
            >
              <HomeIcon className="w-4 h-4" />
              Test Runner
            </button>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Connected</span>
            </div>
          </div>
          
          {/* Tab Navigation in Header */}
          <div className="flex gap-1 -mb-px">
            <button
              onClick={() => handleTabChange('run')}
              className={`px-4 py-2 text-sm font-medium transition-all border-b-2 ${
                activeTab === 'run'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 border-transparent hover:border-gray-300'
              }`}
            >
              <Zap className="w-3.5 h-3.5 inline mr-1.5" />
              Run Test
            </button>
            <button
              onClick={() => handleTabChange('running')}
              className={`px-4 py-2 text-sm font-medium transition-all border-b-2 ${
                activeTab === 'running'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 border-transparent hover:border-gray-300'
              }`}
            >
              <Loader2 className="w-3.5 h-3.5 inline mr-1.5" />
              Running
            </button>
            <button
              onClick={() => handleTabChange('history')}
              className={`px-4 py-2 text-sm font-medium transition-all border-b-2 ${
                activeTab === 'history'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 border-transparent hover:border-gray-300'
              }`}
            >
              <History className="w-3.5 h-3.5 inline mr-1.5" />
              History
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4">

        {/* Tab Content */}
        {activeTab === 'run' && (
          <TestConfiguration onTestStart={(runId) => {
            // Switch to running tab when test starts
            handleTabChange('running');
          }} />
        )}

        {activeTab === 'running' && <RunningTests />}

        {activeTab === 'history' && <TestHistory />}
      </main>
    </div>
  );
}