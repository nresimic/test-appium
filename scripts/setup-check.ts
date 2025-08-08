#!/usr/bin/env node

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

function checkCommand(command: string, name: string): boolean {
    try {
        execSync(command, { stdio: 'ignore' });
        console.log(`✅ ${name} is installed`);
        return true;
    } catch {
        console.log(`❌ ${name} is NOT installed`);
        return false;
    }
}

function checkEnvironmentVariable(varName: string): boolean {
    const value = process.env[varName];
    if (value) {
        console.log(`✅ ${varName} is set: ${value}`);
        return true;
    } else {
        console.log(`❌ ${varName} is NOT set`);
        return false;
    }
}

function checkFile(filePath: string, name: string): boolean {
    if (fs.existsSync(filePath)) {
        console.log(`✅ ${name} exists`);
        return true;
    } else {
        console.log(`❌ ${name} does NOT exist`);
        return false;
    }
}

async function setupCheck() {
    console.log('🔍 Checking Mobile Test Automation Setup\n');

    let allGood = true;

    // Basic requirements
    console.log('📦 Basic Requirements:');
    allGood = allGood && checkCommand('node --version', 'Node.js');
    allGood = allGood && checkCommand('npm --version', 'npm');
    allGood = allGood && checkCommand('java -version', 'Java');
    console.log();

    // Appium
    console.log('🤖 Appium:');
    allGood = allGood && checkCommand('appium --version', 'Appium');
    console.log();

    // Platform specific
    const platform = process.platform;
    
    if (platform === 'darwin') {
        console.log('🍎 iOS Setup (macOS):');
        allGood = allGood && checkCommand('xcode-select --version', 'Xcode Command Line Tools');
        checkCommand('xcrun simctl list devices', 'iOS Simulators');
    }

    console.log('🤖 Android Setup:');
    allGood = allGood && checkEnvironmentVariable('ANDROID_HOME');
    allGood = allGood && checkCommand('adb version', 'ADB (Android Debug Bridge)');
    
    // Check for emulators/devices
    try {
        const devices = execSync('adb devices', { encoding: 'utf-8' });
        const deviceLines = devices.split('\n').filter(line => line.includes('\tdevice') || line.includes('\temulator'));
        if (deviceLines.length > 0) {
            console.log(`✅ Android devices/emulators connected: ${deviceLines.length}`);
        } else {
            console.log('⚠️  No Android devices or emulators connected');
        }
    } catch {
        console.log('❌ Cannot check Android devices');
        allGood = false;
    }
    console.log();

    // Project specific
    console.log('📁 Project Setup:');
    allGood = allGood && checkFile('.env', '.env file');
    allGood = allGood && checkFile('apps/android', 'apps/android directory');
    
    const appsDir = path.join(__dirname, '..', 'apps', 'android');
    if (fs.existsSync(appsDir)) {
        const apkFiles = fs.readdirSync(appsDir).filter(f => f.endsWith('.apk'));
        if (apkFiles.length > 0) {
            console.log(`✅ APK files found: ${apkFiles.length}`);
        } else {
            console.log('⚠️  No APK files found - run "npm run build:fetch"');
        }
    }
    console.log();

    // Recommendations
    console.log('💡 Next Steps:');
    if (!allGood) {
        console.log('❌ Some requirements are missing. Please install missing components.');
    } else {
        console.log('✅ Setup looks good!');
    }
    
    console.log();
    console.log('📚 Commands to try:');
    console.log('   npm run appium:start     # Start Appium server');
    console.log('   npm run build:fetch      # Download latest APK');
    console.log('   npm run test:android     # Run Android tests');
    if (platform === 'darwin') {
        console.log('   npm run test:ios         # Run iOS tests');
    }
    console.log('   npm run allure:serve     # View test reports');
}

setupCheck().catch(console.error);