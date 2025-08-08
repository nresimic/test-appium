/**
 * Centralized exports for all utility functions
 * Following 2024 WebdriverIO best practices
 */

// Wait utilities
export * from './wait.utils';

// Gesture utilities  
export * from './gesture.utils';

// Screenshot utilities
export * from './screenshot.utils';

// Platform utilities
export * from './platform.utils';

// Re-export commonly used functions for convenience
export {
    waitForDisplayed,
    verifyElementDisplayed,
    waitForSystemModalToDismiss,
    clickIfExists
} from './wait.utils';

export {
    swipeUp,
    swipeDown,
    swipeLeft, 
    swipeRight,
    scrollToElement
} from './gesture.utils';

export {
    takeScreenshot,
    takeScreenshotAsBase64
} from './screenshot.utils';

export {
    isIOS,
    isAndroid,
    getPlatform,
    getPlatformSelector
} from './platform.utils';