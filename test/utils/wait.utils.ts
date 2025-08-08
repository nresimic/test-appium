/**
 * Wait utility functions for WebdriverIO tests
 * Consolidated from helpers/wait-helper.ts following 2024 best practices
 */

/**
 * Wait for an element to be displayed with safe error handling
 * Primary wait function with sensible defaults
 */
export async function waitForDisplayed(
    element: WebdriverIO.Element,
    timeout: number = 20000,
    reverse: boolean = false
): Promise<boolean> {
    return await element.waitForDisplayed({
        timeout,
        interval: 500,
        reverse
    }).catch(() => false);
}

/**
 * Verify that an element is displayed (throws error if not)
 * Use this for required elements that MUST be present
 */
export async function verifyElementDisplayed(
    element: WebdriverIO.Element,
    timeout: number = 20000,
    errorMsg?: string
): Promise<void> {
    const isDisplayed = await element.waitForDisplayed({
        timeout,
        interval: 500
    }).catch(() => false);
    
    if (!isDisplayed) {
        throw new Error(errorMsg || `Element not displayed after ${timeout}ms`);
    }
}

/**
 * Click an element only if it exists and is displayed
 */
export async function clickIfExists(
    element: WebdriverIO.Element,
    timeout: number = 20000
): Promise<boolean> {
    const isDisplayed = await waitForDisplayed(element, timeout);
    if (isDisplayed) {
        await element.click();
        return true;
    }
    return false;
}

/**
 * Wait for loading indicators to disappear
 * Platform-aware and doesn't throw errors
 */
export async function waitForLoadingComplete(
    platform: 'ios' | 'android',
    timeout: number = 20000
): Promise<void> {
    const loadingSelectors = platform === 'android' 
        ? [
            '*//android.widget.ProgressBar',
            'android=new UiSelector().className("android.widget.ProgressBar")'
          ]
        : [
            '*//XCUIElementTypeActivityIndicator',
            '*//XCUIElementTypeProgressIndicator'
          ];

    for (const selector of loadingSelectors) {
        try {
            const loadingElement = $(selector);
            const exists = await loadingElement.isExisting().catch(() => false);
            
            if (exists) {
                await waitForDisplayed(loadingElement, timeout, true);  // Wait for it to NOT be displayed
            }
        } catch {
            // Selector not supported or other error, continue
            continue;
        }
    }
}

/**
 * Wait for screen transition by waiting for one element to disappear
 * and another to appear
 */
export async function waitForScreenTransition(
    elementToDisappear: WebdriverIO.Element,
    elementToAppear: WebdriverIO.Element,
    timeout: number = 20000
): Promise<void> {
    // Wait for old element to disappear
    await waitForDisplayed(elementToDisappear, timeout / 2, true);

    // Wait for new element to appear
    await waitForDisplayed(elementToAppear, timeout / 2);
}

/**
 * Retry an action if it fails
 */
export async function retryAction<T>(
    action: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
): Promise<T> {
    let lastError: Error;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await action();
        } catch (error) {
            lastError = error as Error;
            console.log(`Retry ${i + 1}/${maxRetries} failed: ${lastError.message}`);
            
            if (i < maxRetries - 1) {
                await browser.pause(delayMs);
            }
        }
    }
    
    throw lastError!;
}

/**
 * Wait for element and get it when ready
 */
export async function getElementWhenReady(
    selector: string | (() => WebdriverIO.Element),
    timeout: number = 20000
): Promise<WebdriverIO.Element> {
    const getElement = typeof selector === 'string' 
        ? () => $(selector)
        : selector;
    
    const element = await getElement();
    const isDisplayed = await waitForDisplayed(element, timeout);
    
    if (!isDisplayed) {
        throw new Error(`Element not ready after ${timeout}ms`);
    }
    
    return element;
}

/**
 * Wait for iOS system modals (like notification permission) to be dismissed
 * Call this before waiting for app elements when system modals might appear
 */
export async function waitForSystemModalToDismiss(timeout: number = 10000): Promise<void> {
    // Only check for alerts on iOS - Android handles permissions differently
    if (driver.isIOS) {
        await browser.waitUntil(async () => {
            try {
                await browser.getAlertText();
                return false;
            } catch {
                return true;
            }
        }, {
            timeout,
            interval: 500,
            timeoutMsg: `System modal not dismissed after ${timeout}ms`
        }).catch(() => {
            console.log('No system modal detected or timeout waiting for dismissal');
        });
        
        // Small buffer after modal dismissal
        await driver.pause(5000);
    }
    // For Android, we don't need to wait for system modals as they're handled differently
}

/**
 * Smart wait that combines multiple strategies for screen readiness
 */
export async function waitForScreenReady(
    platform: 'ios' | 'android',
    uniqueElement?: WebdriverIO.Element,
    timeout: number = 20000
): Promise<void> {
    // First, wait for any loading to complete
    await waitForLoadingComplete(platform, timeout / 2);
    
    // If a unique element is provided, wait for it
    if (uniqueElement) {
        await waitForDisplayed(uniqueElement, timeout / 2);
    }
    
    // Small stability pause
    await browser.pause(300);
}

/**
 * Dismiss keyboard if it's currently visible
 * Works for both iOS and Android platforms
 */
export async function dismissKeyboard(): Promise<void> {
    try {
        const isKeyboardShown = await driver.isKeyboardShown();
        if (isKeyboardShown) {
            if (driver.isIOS) {
                // iOS: Try multiple methods to dismiss keyboard
                try {
                    // Method 1: Press Done button if available
                    const doneButton = await $('~Done');
                    if (await doneButton.isDisplayed()) {
                        await doneButton.click();
                        return;
                    }
                } catch {
                    // Continue to next method
                }
                
                try {
                    // Method 2: Hide keyboard directly
                    await driver.hideKeyboard();
                } catch {
                    // Method 3: Tap outside keyboard area
                    await driver.touchAction([
                        { action: 'tap', x: 10, y: 10 }
                    ]);
                }
            } else {
                // Android: Use hideKeyboard or press back
                try {
                    await driver.hideKeyboard();
                } catch {
                    // Fallback: Press back button
                    await driver.pressKeyCode(4); // KEYCODE_BACK
                }
            }
        }
    } catch (error) {
        // If keyboard detection fails, try to hide it anyway
        console.log('Could not detect keyboard state, attempting to dismiss anyway');
        try {
            await driver.hideKeyboard();
        } catch {
            // Keyboard probably wasn't shown
        }
    }
}