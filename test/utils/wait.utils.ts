export const TIMEOUTS = {
    ANIMATION: 300,
    QUICK: 3000,
    STANDARD: 10000,
    EXTENDED: 40000,
    APP_LAUNCH: 30000,
    LOGIN: 30000,
    LOGOUT: 15000,
    SESSION: 60000,
    API_CALL: 20000,
    PASSCODE_SCREEN: 10000,
    DASHBOARD_LOAD: 15000,
    SEARCH: 5000,
    MODAL: 5000,
    POLLING_INTERVAL: 100,
    RETRY_DELAY: 1000,
    STABILITY_CHECK: 300,
    CHAR_INPUT_DELAY: 100,
    FIELD_INTERACTION_DELAY: 200,
    LEAN_SDK_LOADING: 5000,
    APP_TERMINATION_DELAY: 1000,
    FAST_POLLING: 300,
    ELEMENT_STABILITY_WAIT: 300,
} as const;

export function getTimeout(timeout: keyof typeof TIMEOUTS): number {
    return TIMEOUTS[timeout];
}

export function getAdjustedTimeout(
    timeout: keyof typeof TIMEOUTS, 
    platform?: string
): number {
    const baseTimeout = getTimeout(timeout);
    let adjustedTimeout = baseTimeout;
    
    if (platform?.toLowerCase() === 'ios') {
        adjustedTimeout = Math.round(baseTimeout * 1.2);
    }
    
    return adjustedTimeout;
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
        if (durationOrCondition > 1000) {
            console.log(`⏱️ Waiting ${durationOrCondition}ms...`);
        }
        await browser.pause(durationOrCondition);
    } else {
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
        checkSize?: boolean;
    } = {}
) {
    const {
        timeout = getAdjustedTimeout('STANDARD'),
        checkInterval = TIMEOUTS.POLLING_INTERVAL,
        stabilityThreshold = 3,
        checkSize = true
    } = options;
    
    let stableCount = 0;
    let lastPosition = { x: -1, y: -1 };
    let lastSize = { width: -1, height: -1 };
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        try {
            const [currentPosition, currentSize] = await Promise.all([
                element.getLocation(),
                checkSize ? element.getSize() : Promise.resolve(lastSize)
            ]);
            
            const positionStable = currentPosition.x === lastPosition.x && 
                                 currentPosition.y === lastPosition.y;
            const sizeStable = !checkSize || 
                             (currentSize.width === lastSize.width && 
                              currentSize.height === lastSize.height);
            
            if (positionStable && sizeStable) {
                stableCount++;
                if (stableCount >= stabilityThreshold) {
                    await smartWait(TIMEOUTS.ELEMENT_STABILITY_WAIT);
                    return;
                }
            } else {
                stableCount = 0;
                lastPosition = currentPosition;
                if (checkSize) lastSize = currentSize;
            }
        } catch (error) {
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
    const adjustedTimeout = getAdjustedTimeout('EXTENDED');
    const pollInterval = TIMEOUTS.FAST_POLLING;
    
    const isDisplayed = await element.waitForDisplayed({
        timeout: timeout || adjustedTimeout,
        interval: pollInterval,
        timeoutMsg: errorMsg
    }).catch(() => false);
    
    if (!isDisplayed) {
        const selector = typeof element.selector === 'string' ? element.selector : 'unknown selector';
        const isExisting = await element.isExisting().catch(() => false);
        
        let message = errorMsg || `Element not displayed after ${timeout || adjustedTimeout}ms`;
        if (!isExisting) {
            message += ` (element doesn't exist in DOM)`;
        } else {
            message += ` (element exists but is hidden)`;
        }
        message += ` - Selector: ${selector}`;
        
        const { ElementNotFoundError } = await import('./error.utils');
        throw new ElementNotFoundError(selector, timeout || adjustedTimeout);
    }
}

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
            continue;
        }
    }
}

export async function waitForScreenTransition(
    elementToDisappear: WebdriverIO.Element,
    elementToAppear: WebdriverIO.Element,
    timeout: number = TIMEOUTS.EXTENDED
): Promise<void> {
    await waitForDisplayed(elementToDisappear, timeout / 2, true);
    await waitForDisplayed(elementToAppear, timeout / 2);
}

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
    const { maxRetries = 3, delayMs = TIMEOUTS.RETRY_DELAY, description = 'Action', exponentialBackoff = true, onRetry } = options;
    let lastError: Error;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            if (i > 0) console.log(`🔄 Retry ${i}/${maxRetries - 1} for: ${description}`);
            return await action();
        } catch (error) {
            lastError = error as Error;
            console.log(`❌ ${description} failed (attempt ${i + 1}/${maxRetries}): ${lastError.message}`);
            
            if (i < maxRetries - 1) {
                await executeRetryDelay(i, delayMs, exponentialBackoff, onRetry, lastError);
            }
        }
    }
    
    const { TestError } = await import('./error.utils');
    throw new TestError(`${description} failed after ${maxRetries} attempts`, { originalError: lastError!.message }, false);
}

async function executeRetryDelay(
    attempt: number,
    delayMs: number,
    exponentialBackoff: boolean,
    onRetry?: (attempt: number, error: Error) => Promise<void>,
    error?: Error
) {
    if (onRetry && error) await onRetry(attempt + 1, error);
    const delay = exponentialBackoff ? delayMs * Math.pow(2, attempt) : delayMs;
    await smartWait(delay);
}

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
        if (waitFirst) {
            await waitForDisplayed(element, TIMEOUTS.STANDARD);
        }
        
        if (scrollIntoView) {
            await element.scrollIntoView();
            await smartWait(TIMEOUTS.ANIMATION);
        }
        
        await element.waitForClickable({
            timeout: TIMEOUTS.QUICK,
            timeoutMsg: 'Element not clickable'
        });
        
        await element.click();
    }, {
        maxRetries,
        description: 'Click element',
        onRetry: async (attempt) => {
            if (attempt === 2) {
                await dismissKeyboard();
            }
        }
    });
}

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
        await prepareFieldForInput(element, clickFirst, clearFirst);
        await setFieldValue(element, value, platform);
        await verifyFieldValue(element, value);
    }, {
        maxRetries: 3,
        description: `Set value "${value}"`,
        exponentialBackoff: false
    });
}

async function prepareFieldForInput(element: WebdriverIO.Element, clickFirst: boolean, clearFirst: boolean) {
    if (clickFirst) {
        await element.click();
        await waitAfterFieldInteraction();
    }
    
    if (clearFirst) {
        await element.clearValue();
        await waitAfterFieldInteraction();
    }
}

async function setFieldValue(element: WebdriverIO.Element, value: string, platform?: 'ios' | 'android') {
    if (platform === 'ios') {
        for (const char of value) {
            await element.addValue(char);
            await waitAfterInput('ios');
        }
    } else {
        await element.setValue(value);
    }
}

async function verifyFieldValue(element: WebdriverIO.Element, expectedValue: string) {
    const actualValue = await element.getValue();
    if (actualValue !== expectedValue) {
        throw new Error(`Value mismatch. Expected: "${expectedValue}", Got: "${actualValue}"`);
    }
}

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

export async function waitForSystemModalToDismiss(timeout: number = TIMEOUTS.EXTENDED) {
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
        
        await smartWait(TIMEOUTS.ANIMATION);
    }
}

export async function waitForScreenReady(
    platform: 'ios' | 'android',
    uniqueElement?: WebdriverIO.Element,
    timeout: number = TIMEOUTS.EXTENDED
): Promise<void> {
    await waitForLoadingComplete(platform, timeout / 2);
    
    if (uniqueElement) {
        await waitForDisplayed(uniqueElement, timeout / 2);
    }
    
    await smartWait(TIMEOUTS.STABILITY_CHECK);
}

export async function waitForPasscodeScreen(timeout: number = TIMEOUTS.PASSCODE_SCREEN): Promise<boolean> {
    const passcodeTitle = $('~Enter Vault22 Passcode');
    return await waitForDisplayed(passcodeTitle, timeout, false, 'Passcode Screen');
}

export async function waitAfterInput(platform?: 'ios' | 'android'): Promise<void> {
    const delay = platform === 'ios' ? TIMEOUTS.CHAR_INPUT_DELAY : 50;
    await smartWait(delay);
}

export async function waitForSearchResults(): Promise<void> {
    await smartWait(TIMEOUTS.SEARCH);
}

export async function waitAfterFieldInteraction(): Promise<void> {
    await smartWait(TIMEOUTS.FIELD_INTERACTION_DELAY);
}

export async function waitForModal(_appear: boolean = true): Promise<void> {
    await smartWait(TIMEOUTS.MODAL);
}

export async function waitForAnimation(): Promise<void> {
    await smartWait(TIMEOUTS.ANIMATION);
}

export async function waitAfterAppTermination(): Promise<void> {
    await smartWait(TIMEOUTS.APP_TERMINATION_DELAY);
}

export async function dismissKeyboard(): Promise<void> {
    try {
        const isKeyboardShown = await driver.isKeyboardShown();
        if (isKeyboardShown) {
            if (driver.isIOS) {
                await dismissIOSKeyboard();
            } else {
                await dismissAndroidKeyboard();
            }
        }
    } catch (error) {
        console.log('Could not detect keyboard state, attempting to dismiss anyway');
        try {
            await driver.hideKeyboard();
        } catch {
        }
    }
}

async function dismissIOSKeyboard() {
    try {
        const doneButton = await $('~Done');
        if (await doneButton.isDisplayed()) {
            await doneButton.click();
            return;
        }
    } catch {
    }
    
    try {
        await driver.hideKeyboard();
    } catch {
        await driver.touchAction([
            { action: 'tap', x: 10, y: 10 }
        ]);
    }
}

async function dismissAndroidKeyboard() {
    try {
        await driver.hideKeyboard();
    } catch {
        await driver.pressKeyCode(4);
    }
}