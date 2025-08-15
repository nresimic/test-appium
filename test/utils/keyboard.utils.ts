/**
 * Keyboard utility functions for WebdriverIO mobile tests
 * Provides keyboard management functions for iOS and Android platforms
 */

import { isIOS, isAndroid } from './platform.utils';
import allure from '@wdio/allure-reporter';

/**
 * Hide the keyboard on both iOS and Android platforms
 * Uses platform-specific strategies to dismiss the keyboard
 */
export async function hideKeyboard(): Promise<void> {
    try {
        if (isIOS()) {
            await hideKeyboardIOS();
        } else if (isAndroid()) {
            await hideKeyboardAndroid();
        }
        allure.addStep('Keyboard hidden successfully');
    } catch (error) {
        console.log('Failed to hide keyboard, it might already be hidden:', error);
    }
}

/**
 * Hide keyboard on iOS
 * Uses multiple strategies to ensure keyboard is dismissed
 */
async function hideKeyboardIOS(): Promise<void> {
    try {
        // Strategy 1: Try to tap Done button if it exists
        const doneButton = await $('~Done');
        if (await doneButton.isExisting()) {
            await doneButton.click();
            return;
        }
    } catch (e) {
        // Continue to next strategy
    }

    try {
        // Strategy 2: Try to tap Return button if it exists
        const returnButton = await $('~Return');
        if (await returnButton.isExisting()) {
            await returnButton.click();
            return;
        }
    } catch (e) {
        // Continue to next strategy
    }

    try {
        // Strategy 3: Try native hide keyboard command
        await driver.hideKeyboard();
    } catch (e) {
        // Continue to next strategy
    }

    try {
        // Strategy 4: Tap outside the keyboard area (top of screen)
        const { width, height } = await driver.getWindowSize();
        await driver.touchAction([
            { action: 'tap', x: width / 2, y: height * 0.1 }
        ]);
    } catch (e) {
        console.log('All iOS keyboard hiding strategies failed');
    }
}

/**
 * Hide keyboard on Android
 * Uses Android-specific strategies to dismiss the keyboard
 */
async function hideKeyboardAndroid(): Promise<void> {
    try {
        // Strategy 1: Use native hideKeyboard command
        await driver.hideKeyboard();
    } catch (e) {
        try {
            // Strategy 2: Press back button (common Android pattern)
            await driver.back();
        } catch (backError) {
            try {
                // Strategy 3: Tap outside keyboard area
                const { width, height } = await driver.getWindowSize();
                await driver.touchAction([
                    { action: 'tap', x: width / 2, y: height * 0.1 }
                ]);
            } catch (tapError) {
                console.log('All Android keyboard hiding strategies failed');
            }
        }
    }
}

/**
 * Check if keyboard is shown
 * Returns true if keyboard is currently visible
 */
export async function isKeyboardShown(): Promise<boolean> {
    try {
        if (isIOS()) {
            // Check for iOS keyboard
            const keyboard = await $('XCUIElementTypeKeyboard');
            return await keyboard.isDisplayed();
        } else if (isAndroid()) {
            // Check for Android keyboard using driver method
            return await driver.isKeyboardShown();
        }
    } catch (error) {
        console.log('Error checking keyboard status:', error);
        return false;
    }
    return false;
}

/**
 * Wait for keyboard to appear
 * Useful after clicking on input fields
 */
export async function waitForKeyboard(timeout: number = 5000): Promise<void> {
    await browser.waitUntil(
        async () => await isKeyboardShown(),
        {
            timeout,
            timeoutMsg: 'Keyboard did not appear within timeout'
        }
    );
    allure.addStep('Keyboard appeared');
}

/**
 * Wait for keyboard to disappear
 * Useful after submitting forms or hiding keyboard
 */
export async function waitForKeyboardToDisappear(timeout: number = 5000): Promise<void> {
    await browser.waitUntil(
        async () => !(await isKeyboardShown()),
        {
            timeout,
            timeoutMsg: 'Keyboard did not disappear within timeout'
        }
    );
    allure.addStep('Keyboard disappeared');
}

/**
 * Type text and automatically hide keyboard afterwards
 * Useful for form inputs where keyboard overlaps submit buttons
 */
export async function typeAndHideKeyboard(
    element: WebdriverIO.Element,
    text: string
): Promise<void> {
    await element.setValue(text);
    await browser.pause(500); // Small pause to ensure text is entered
    await hideKeyboard();
}

/**
 * Clear field, type new text, and hide keyboard
 * Complete flow for updating input fields
 */
export async function clearTypeAndHideKeyboard(
    element: WebdriverIO.Element,
    text: string
): Promise<void> {
    await element.clearValue();
    await element.setValue(text);
    await browser.pause(500); // Small pause to ensure text is entered
    await hideKeyboard();
}

/**
 * Press Enter/Return key on keyboard
 * Platform-specific implementation
 */
export async function pressEnterKey(): Promise<void> {
    if (isIOS()) {
        try {
            const returnButton = await $('~Return');
            if (await returnButton.isExisting()) {
                await returnButton.click();
            } else {
                // Fallback to hide keyboard
                await hideKeyboard();
            }
        } catch (e) {
            await hideKeyboard();
        }
    } else if (isAndroid()) {
        await driver.pressKeyCode(66); // Enter key code for Android
    }
}

/**
 * Press Tab key to move to next field
 * Useful for form navigation
 */
export async function pressTabKey(): Promise<void> {
    if (isAndroid()) {
        await driver.pressKeyCode(61); // Tab key code for Android
    } else if (isIOS()) {
        // iOS doesn't have a tab key on keyboard, use Next button if available
        try {
            const nextButton = await $('~Next');
            if (await nextButton.isExisting()) {
                await nextButton.click();
            }
        } catch (e) {
            console.log('Tab/Next navigation not available on iOS');
        }
    }
}

/**
 * Ensure keyboard is hidden before performing an action
 * Decorator function for actions that might be blocked by keyboard
 */
export async function withKeyboardHidden<T>(
    action: () => Promise<T>
): Promise<T> {
    if (await isKeyboardShown()) {
        await hideKeyboard();
        await waitForKeyboardToDisappear();
    }
    return await action();
}