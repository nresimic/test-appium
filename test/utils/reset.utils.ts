/**
 * App reset utilities for test isolation
 * Provides different levels of app state reset for mobile testing
 * Platform-aware implementation for both iOS and Android
 */

import { waitAfterAppTermination } from './wait.utils';

/**
 * Get the current app identifier based on platform
 * Returns package name for Android or bundle ID for iOS
 */
async function getAppIdentifier(): Promise<string> {
    const capabilities = browser.capabilities as any;
    const platform = capabilities.platformName?.toLowerCase();
    
    if (platform === 'android') {
        // Android: Use getCurrentPackage
        return await driver.getCurrentPackage();
    } else if (platform === 'ios') {
        // iOS: Try to get bundle ID from capabilities first
        const bundleId = capabilities['appium:bundleId'] || 
                        capabilities['bundleId'] ||
                        capabilities['appium:appPackage']; // Sometimes set for cross-platform configs
        
        if (bundleId) {
            return bundleId;
        }
        
        // Fallback: Use known bundle ID for Vault22 app
        // This could be made configurable via environment variable
        return process.env.IOS_BUNDLE_ID || 'com.vault22.next.uae.develop';
    } else {
        throw new Error(`Unsupported platform: ${platform}`);
    }
}

/**
 * Check if we're running on iOS
 */
function isIOS(): boolean {
    const capabilities = browser.capabilities as any;
    return capabilities.platformName?.toLowerCase() === 'ios';
}

/**
 * Check if we're running on Android
 */
function isAndroid(): boolean {
    const capabilities = browser.capabilities as any;
    return capabilities.platformName?.toLowerCase() === 'android';
}

/**
 * Light reset: Clear app data and restart app (fast, keeps app installed)
 * Use for: Most tests that need clean state but don't require full session reset
 * Note: clearApp is Android-only, iOS uses removeApp + installApp
 */
export async function clearAppAndActivate(): Promise<void> {
    try {
        const appId = await getAppIdentifier();
        const platform = isIOS() ? 'iOS' : 'Android';
        
        if (isAndroid()) {
            // Android: Clear app data (like fresh install but keeps app)
            await driver.execute('mobile: clearApp', {
                appId: appId
            });
            
            // Restart the app after clearing data
            await driver.execute('mobile: activateApp', {
                appId: appId
            });
        } else if (isIOS()) {
            // iOS limitation: No clearApp command available
            // Best practice: Use session reload for full reset
            // For light reset, just terminate and reactivate (won't clear data)
            console.log('⚠️ iOS: clearApp not supported, using terminate/activate (data persists)');
            
            // Terminate the app
            await driver.execute('mobile: terminateApp', {
                bundleId: appId
            });
            
            await waitAfterAppTermination();
            
            // Reactivate the app
            await driver.execute('mobile: activateApp', {
                bundleId: appId
            });
            
            // Note: This does NOT clear app data on iOS
            // For full data clear, use reloadSession() instead
        }
        
        console.log(`✅ Light reset completed for ${appId} (${platform})`);
    } catch (error) {
        console.error('❌ Light reset failed:', error);
        throw error;
    }
}

/**
 * Heavy reset: Complete session reload (slow, reinstalls app)
 * Use for: Authentication tests, tests requiring complete isolation
 */
export async function reloadSession(): Promise<void> {
    try {
        await browser.reloadSession();
        console.log('✅ Heavy reset completed (session reloaded)');
    } catch (error) {
        console.error('❌ Heavy reset failed:', error);
        throw error;
    }
}

/**
 * Medium reset: Terminate and reactivate app (medium speed)
 * Use for: Tests that need app restart but not full session reload
 */
export async function terminateAndActivateApp(): Promise<void> {
    try {
        const appId = await getAppIdentifier();
        const platform = isIOS() ? 'iOS' : 'Android';
        
        if (isAndroid()) {
            // Android: Terminate the app completely
            await driver.execute('mobile: terminateApp', {
                appId: appId
            });
            
            // Wait a moment for app to fully terminate
            await waitAfterAppTermination();
            
            // Reactivate the app
            await driver.execute('mobile: activateApp', {
                appId: appId
            });
        } else if (isIOS()) {
            // iOS: Use bundleId instead of appId
            await driver.execute('mobile: terminateApp', {
                bundleId: appId
            });
            
            // Wait a moment for app to fully terminate
            await waitAfterAppTermination();
            
            // Reactivate the app
            await driver.execute('mobile: activateApp', {
                bundleId: appId
            });
        }
        
        console.log(`✅ Medium reset completed for ${appId} (${platform})`);
    } catch (error) {
        console.error('❌ Medium reset failed:', error);
        throw error;
    }
}

/**
 * Background reset: Send app to background and bring back (lightest)
 * Use for: Tests that just need to trigger app lifecycle events
 */
export async function backgroundAndActivateApp(seconds: number = 3): Promise<void> {
    try {
        const appId = await getAppIdentifier();
        const platform = isIOS() ? 'iOS' : 'Android';
        
        if (isAndroid()) {
            // Android: Send app to background
            await driver.execute('mobile: backgroundApp', {
                seconds: seconds
            });
            
            // Ensure it's active (backgroundApp should auto-restore, but be explicit)
            await driver.execute('mobile: activateApp', {
                appId: appId
            });
        } else if (isIOS()) {
            // iOS: backgroundApp works differently
            // Use the generic browser.background() which works cross-platform
            await browser.background(seconds);
            
            // Ensure it's active
            await driver.execute('mobile: activateApp', {
                bundleId: appId
            });
        }
        
        console.log(`✅ Background reset completed for ${appId} (${platform}, ${seconds}s)`);
    } catch (error) {
        console.error('❌ Background reset failed:', error);
        throw error;
    }
}

/**
 * Reset strategies enum for easy reference
 */
export enum ResetStrategy {
    LIGHT = 'light',           // clearAppAndActivate()
    MEDIUM = 'medium',         // terminateAndActivateApp() 
    HEAVY = 'heavy',           // reloadSession()
    BACKGROUND = 'background'  // backgroundAndActivateApp()
}

/**
 * Universal reset function - choose your strategy
 * @param strategy - Reset level to use
 * @param options - Additional options (e.g., backgroundSeconds for BACKGROUND strategy)
 */
export async function resetAppState(
    strategy: ResetStrategy = ResetStrategy.LIGHT, 
    options: { backgroundSeconds?: number } = {}
): Promise<void> {
    console.log(`🔄 Executing ${strategy} reset...`);
    
    switch (strategy) {
        case ResetStrategy.LIGHT:
            await clearAppAndActivate();
            break;
        case ResetStrategy.MEDIUM:
            await terminateAndActivateApp();
            break;
        case ResetStrategy.HEAVY:
            await reloadSession();
            break;
        case ResetStrategy.BACKGROUND:
            await backgroundAndActivateApp(options.backgroundSeconds || 3);
            break;
        default:
            throw new Error(`Unknown reset strategy: ${strategy}`);
    }
}