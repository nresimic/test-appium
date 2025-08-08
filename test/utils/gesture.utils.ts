/**
 * Gesture utility functions for WebdriverIO mobile tests
 * Migrated from helpers/gestures.ts following 2024 best practices
 */

export enum SwipeDirection {
    UP = 'up',
    DOWN = 'down',
    LEFT = 'left',
    RIGHT = 'right'
}

/**
 * Perform swipe gesture with platform-specific handling
 */
export async function swipe(direction: SwipeDirection): Promise<void> {
    const isIOS = driver.capabilities.platformName === 'iOS';
    
    if (isIOS) {
        await browser.execute('mobile: swipe', { direction });
    } else {
        await browser.execute('mobile: swipe', {
            direction,
            percent: 0.75
        });
    }
}

/**
 * Scroll to element by performing swipe gestures
 * Returns true if element becomes visible, false if max scrolls reached
 */
export async function scrollToElement(selector: string, maxScrolls: number = 5): Promise<boolean> {
    for (let i = 0; i < maxScrolls; i++) {
        if (await $(selector).isDisplayed()) {
            return true;
        }
        await swipe(SwipeDirection.UP);
    }
    return false;
}

/**
 * Scroll to element with custom swipe direction
 */
export async function scrollToElementWithDirection(
    selector: string, 
    direction: SwipeDirection = SwipeDirection.UP,
    maxScrolls: number = 5
): Promise<boolean> {
    for (let i = 0; i < maxScrolls; i++) {
        if (await $(selector).isDisplayed()) {
            return true;
        }
        await swipe(direction);
    }
    return false;
}

/**
 * Perform swipe up gesture (most common)
 */
export async function swipeUp(): Promise<void> {
    await swipe(SwipeDirection.UP);
}

/**
 * Perform swipe down gesture  
 */
export async function swipeDown(): Promise<void> {
    await swipe(SwipeDirection.DOWN);
}

/**
 * Perform swipe left gesture
 */
export async function swipeLeft(): Promise<void> {
    await swipe(SwipeDirection.LEFT);
}

/**
 * Perform swipe right gesture
 */
export async function swipeRight(): Promise<void> {
    await swipe(SwipeDirection.RIGHT);
}