/**
 * Platform utility functions for WebdriverIO mobile tests
 * Provides platform detection and platform-specific logic
 */

export type Platform = 'ios' | 'android';

/**
 * Get current platform from driver capabilities
 */
export function getPlatform(): Platform {
    return (driver.capabilities.platformName as string).toLowerCase() as Platform;
}

/**
 * Check if current platform is iOS
 */
export function isIOS(): boolean {
    return getPlatform() === 'ios';
}

/**
 * Check if current platform is Android  
 */
export function isAndroid(): boolean {
    return getPlatform() === 'android';
}

/**
 * Get platform-specific selector from selector object
 */
export function getPlatformSelector(selector: string | { android: string; ios: string }): string {
    if (typeof selector === 'string') {
        return selector;
    }
    
    return isIOS() ? selector.ios : selector.android;
}

/**
 * Execute platform-specific logic
 */
export async function executePlatformSpecific<T>(
    iosAction: () => Promise<T>,
    androidAction: () => Promise<T>
): Promise<T> {
    if (isIOS()) {
        return await iosAction();
    } else {
        return await androidAction();
    }
}

/**
 * Get platform-specific configuration value
 */
export function getPlatformConfig<T>(config: { ios: T; android: T }): T {
    return isIOS() ? config.ios : config.android;
}

/**
 * Get platform-specific timeout values
 */
export function getPlatformTimeout(baseTimeout: number = 20000): number {
    // iOS generally needs longer timeouts due to animation delays
    return isIOS() ? baseTimeout * 1.2 : baseTimeout;
}

/**
 * Get platform version if available
 */
export function getPlatformVersion(): string | undefined {
    const caps = driver.capabilities as any;
    return caps.platformVersion || caps['appium:platformVersion'] || caps.version;
}

/**
 * Get device name if available
 */
export function getDeviceName(): string | undefined {
    const caps = driver.capabilities as any;
    return caps['appium:deviceName'] || caps.deviceName || caps.device;
}

/**
 * Check if running on simulator/emulator
 */
export function isSimulator(): boolean {
    const deviceName = getDeviceName()?.toLowerCase();
    if (!deviceName) return false;
    
    if (isIOS()) {
        return deviceName.includes('simulator');
    } else {
        return deviceName.includes('emulator');
    }
}

/**
 * Get platform-specific element locator strategies
 */
export function getPlatformLocators() {
    return {
        textField: isIOS() ? 'XCUIElementTypeTextField' : 'android.widget.EditText',
        button: isIOS() ? 'XCUIElementTypeButton' : 'android.widget.Button',
        text: isIOS() ? 'XCUIElementTypeStaticText' : 'android.widget.TextView',
        scroll: isIOS() ? 'XCUIElementTypeScrollView' : 'android.widget.ScrollView',
        progressBar: isIOS() ? 'XCUIElementTypeActivityIndicator' : 'android.widget.ProgressBar'
    };
}

/**
 * Platform-specific pause durations for stability
 */
export function getPlatformPauseDuration(type: 'short' | 'medium' | 'long' = 'short'): number {
    const baseDurations = {
        short: 500,
        medium: 1000, 
        long: 2000
    };
    
    // iOS typically needs slightly longer pauses
    const multiplier = isIOS() ? 1.2 : 1;
    return Math.round(baseDurations[type] * multiplier);
}