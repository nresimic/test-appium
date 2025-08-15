export const TIMEOUTS = {
    // UI Operations
    ANIMATION: 500,       // UI animations, keyboard appearance
    QUICK: 3000,         // Fast UI operations
    STANDARD: 10000,     // Standard element wait
    EXTENDED: 40000,     // Complex operations, network requests
    
    // App States
    APP_LAUNCH: 30000,   // App startup
    LOGIN: 30000,        // Login flow completion
    LOGOUT: 15000,       // Logout flow completion
    SESSION: 60000,      // Session creation/reload
    
    // Network
    API_CALL: 20000,     // API requests
    
    // Specific Operations
    PASSCODE_SCREEN: 10000,  // Passcode screen appearance
    DASHBOARD_LOAD: 15000,   // Dashboard fully loaded
    SEARCH: 5000,            // Search results appear
    MODAL: 5000,             // Modal appearance/dismissal
    
    // Retry & Polling
    POLLING_INTERVAL: 500,   // Check interval for conditions
    RETRY_DELAY: 1000,       // Base delay between retries
    STABILITY_CHECK: 300,    // Element stability check
    
    // Character input delay for iOS
    CHAR_INPUT_DELAY: 100,   // Delay between character inputs on iOS
    
    // Field clear/click delay
    FIELD_INTERACTION_DELAY: 500, // Delay after clicking/clearing fields
    
    // Third-party SDK loading
    LEAN_SDK_LOADING: 5000,      // Lean SDK initialization time
    
    // App termination
    APP_TERMINATION_DELAY: 1000,  // Wait after app termination
} as const;

export function getTimeout(timeout: keyof typeof TIMEOUTS): number {
    const multiplier = process.env.TIMEOUT_MULTIPLIER ? 
        parseFloat(process.env.TIMEOUT_MULTIPLIER) : 1;
    return TIMEOUTS[timeout] * multiplier;
}

export function getAdjustedTimeout(
    timeout: keyof typeof TIMEOUTS, 
    platform?: string
): number {
    const baseTimeout = getTimeout(timeout);
    
    // iOS tends to be slower with animations
    if (platform?.toLowerCase() === 'ios') {
        return Math.round(baseTimeout * 1.2);
    }
    
    return baseTimeout;
}

export async function smartWait(
    durationOrCondition: number | (() => Promise<boolean>),
    options: {
        timeout?: number;
        interval?: number;
        message?: string;
    } = {}
) {
    if (typeof durationOrCondition === 'number') {
        // Simple delay - but log it for tracking
        if (durationOrCondition > 1000) {
            console.log(`⏱️ Waiting ${durationOrCondition}ms...`);
        }
        await browser.pause(durationOrCondition);
    } else {
        // Wait for condition
        const { timeout = TIMEOUTS.STANDARD, interval = TIMEOUTS.POLLING_INTERVAL, message } = options;
        await browser.waitUntil(durationOrCondition, {
            timeout,
            interval,
            timeoutMsg: message || 'Condition not met within timeout'
        });
    }
}

export async function waitForElementStable(
    element: WebdriverIO.Element,
    options: {
        timeout?: number;
        checkInterval?: number;
        stabilityThreshold?: number;
    } = {}
) {
    const {
        timeout = TIMEOUTS.STANDARD,
        checkInterval = TIMEOUTS.POLLING_INTERVAL,
        stabilityThreshold = 3
    } = options;
    
    let stableCount = 0;
    let lastPosition = { x: -1, y: -1 };
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        try {
            const currentPosition = await element.getLocation();
            
            if (currentPosition.x === lastPosition.x && 
                currentPosition.y === lastPosition.y) {
                stableCount++;
                if (stableCount >= stabilityThreshold) {
                    return; // Element is stable
                }
            } else {
                stableCount = 0;
                lastPosition = currentPosition;
            }
        } catch (error) {
            // Element might not be visible yet
            stableCount = 0;
        }
        
        await smartWait(checkInterval);
    }
    
    throw new Error(`Element did not stabilize within ${timeout}ms`);
}

export async function waitForDisplayed(
    element: WebdriverIO.Element,
    timeout: number = TIMEOUTS.STANDARD,
    reverse: boolean = false,
    elementName?: string
) {
    return await element.waitForDisplayed({
        timeout,
        interval: 500,
        reverse,
        timeoutMsg: elementName 
            ? `${elementName} not ${reverse ? 'hidden' : 'displayed'} after ${timeout}ms`
            : undefined
    }).catch(() => false);
}

export async function verifyElementDisplayed(
    element: WebdriverIO.Element,
    timeout: number = TIMEOUTS.EXTENDED,
    errorMsg?: string
) {
    const isDisplayed = await element.waitForDisplayed({
        timeout,
        interval: 2000,
        timeoutMsg: errorMsg
    }).catch(() => false);
    
    if (!isDisplayed) {
        const selector = typeof element.selector === 'string' ? element.selector : 'unknown selector';
        const isExisting = await element.isExisting().catch(() => false);
        
        let message = errorMsg || `Element not displayed after ${timeout}ms`;
        if (!isExisting) {
            message += ` (element doesn't exist in DOM)`;
        } else {
            message += ` (element exists but is hidden)`;
        }
        message += ` - Selector: ${selector}`;
        
        throw new Error(message);
    }
}

/**
 * Click an element only if it exists and is displayed
 */
export async function clickIfExists(
    element: WebdriverIO.Element,
    timeout: number = TIMEOUTS.STANDARD
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
    timeout: number = TIMEOUTS.EXTENDED
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
    timeout: number = TIMEOUTS.EXTENDED
): Promise<void> {
    // Wait for old element to disappear
    await waitForDisplayed(elementToDisappear, timeout / 2, true);

    // Wait for new element to appear
    await waitForDisplayed(elementToAppear, timeout / 2);
}

/**
 * Retry an action if it fails with exponential backoff
 */
export async function retryAction<T>(
    action: () => Promise<T>,
    options: {
        maxRetries?: number;
        delayMs?: number;
        description?: string;
        exponentialBackoff?: boolean;
        onRetry?: (attempt: number, error: Error) => Promise<void>;
    } = {}
): Promise<T> {
    const {
        maxRetries = 3,
        delayMs = TIMEOUTS.RETRY_DELAY,
        description = 'Action',
        exponentialBackoff = true,
        onRetry
    } = options;
    
    let lastError: Error;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            if (i > 0) {
                console.log(`🔄 Retry ${i}/${maxRetries - 1} for: ${description}`);
            }
            return await action();
        } catch (error) {
            lastError = error as Error;
            console.log(`❌ ${description} failed (attempt ${i + 1}/${maxRetries}): ${lastError.message}`);
            
            if (i < maxRetries - 1) {
                // Call onRetry hook if provided
                if (onRetry) {
                    await onRetry(i + 1, lastError);
                }
                
                // Calculate delay with optional exponential backoff
                const delay = exponentialBackoff ? delayMs * Math.pow(2, i) : delayMs;
                await smartWait(delay);
            }
        }
    }
    
    throw new Error(`${description} failed after ${maxRetries} attempts: ${lastError!.message}`);
}

/**
 * Retry clicking an element with smart recovery
 */
export async function retryClick(
    element: WebdriverIO.Element,
    options: {
        maxRetries?: number;
        waitFirst?: boolean;
        scrollIntoView?: boolean;
    } = {}
): Promise<void> {
    const { maxRetries = 3, waitFirst = true, scrollIntoView = false } = options;
    
    await retryAction(async () => {
        // Wait for element to be displayed if requested
        if (waitFirst) {
            await waitForDisplayed(element, TIMEOUTS.STANDARD);
        }
        
        // Scroll into view if requested
        if (scrollIntoView) {
            await element.scrollIntoView();
            await smartWait(TIMEOUTS.ANIMATION);
        }
        
        // Ensure element is clickable
        await element.waitForClickable({
            timeout: TIMEOUTS.QUICK,
            timeoutMsg: 'Element not clickable'
        });
        
        // Click the element
        await element.click();
    }, {
        maxRetries,
        description: 'Click element',
        onRetry: async (attempt) => {
            // Try to recover from common issues
            if (attempt === 2) {
                // On second retry, try dismissing keyboard if it might be blocking
                await dismissKeyboard();
            }
        }
    });
}

/**
 * Retry setting value in a field with smart clearing
 */
export async function retrySetValue(
    element: WebdriverIO.Element,
    value: string,
    options: {
        clearFirst?: boolean;
        clickFirst?: boolean;
        platform?: 'ios' | 'android';
    } = {}
): Promise<void> {
    const { clearFirst = true, clickFirst = true, platform } = options;
    
    await retryAction(async () => {
        // Click field if requested
        if (clickFirst) {
            await element.click();
            await waitAfterFieldInteraction();
        }
        
        // Clear field if requested
        if (clearFirst) {
            await element.clearValue();
            await waitAfterFieldInteraction();
        }
        
        // Set the value
        if (platform === 'ios') {
            // iOS sometimes needs character-by-character input
            for (const char of value) {
                await element.addValue(char);
                await waitAfterInput('ios');
            }
        } else {
            await element.setValue(value);
        }
        
        // Verify the value was set correctly
        const actualValue = await element.getValue();
        if (actualValue !== value) {
            throw new Error(`Value mismatch. Expected: "${value}", Got: "${actualValue}"`);
        }
    }, {
        maxRetries: 3,
        description: `Set value "${value}"`,
        exponentialBackoff: false
    });
}

/**
 * Wait for element and get it when ready
 */
export async function getElementWhenReady(
    selector: string | (() => WebdriverIO.Element),
    timeout: number = TIMEOUTS.STANDARD
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
export async function waitForSystemModalToDismiss(timeout: number = TIMEOUTS.EXTENDED) {
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
        await smartWait(TIMEOUTS.ANIMATION);
    }
    // For Android, we don't need to wait for system modals as they're handled differently
}

/**
 * Smart wait that combines multiple strategies for screen readiness
 */
export async function waitForScreenReady(
    platform: 'ios' | 'android',
    uniqueElement?: WebdriverIO.Element,
    timeout: number = TIMEOUTS.EXTENDED
): Promise<void> {
    // First, wait for any loading to complete
    await waitForLoadingComplete(platform, timeout / 2);
    
    // If a unique element is provided, wait for it
    if (uniqueElement) {
        await waitForDisplayed(uniqueElement, timeout / 2);
    }
    
    // Small stability pause
    await smartWait(TIMEOUTS.STABILITY_CHECK);
}

/**
 * Wait for passcode screen to appear
 * Specifically for the app's passcode re-authentication
 */
export async function waitForPasscodeScreen(timeout: number = TIMEOUTS.PASSCODE_SCREEN): Promise<boolean> {
    const passcodeTitle = $('~Enter Vault22 Passcode');
    return await waitForDisplayed(passcodeTitle, timeout, false, 'Passcode Screen');
}

/**
 * Wait after entering text into a field
 * Handles platform-specific delays
 */
export async function waitAfterInput(platform?: 'ios' | 'android'): Promise<void> {
    const delay = platform === 'ios' ? TIMEOUTS.CHAR_INPUT_DELAY : 50;
    await smartWait(delay);
}

/**
 * Wait for search results to update
 */
export async function waitForSearchResults(): Promise<void> {
    await smartWait(TIMEOUTS.SEARCH);
}

/**
 * Wait after field interaction (click, clear, etc.)
 */
export async function waitAfterFieldInteraction(): Promise<void> {
    await smartWait(TIMEOUTS.FIELD_INTERACTION_DELAY);
}

/**
 * Wait for modal to appear or disappear
 */
export async function waitForModal(_appear: boolean = true): Promise<void> {
    // Wait for modal animation to complete
    // In future, we can use the appear parameter to wait for specific states
    await smartWait(TIMEOUTS.MODAL);
}

/**
 * Wait for animation to complete
 */
export async function waitForAnimation(): Promise<void> {
    await smartWait(TIMEOUTS.ANIMATION);
}

/**
 * Wait after app termination
 */
export async function waitAfterAppTermination(): Promise<void> {
    await smartWait(TIMEOUTS.APP_TERMINATION_DELAY);
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