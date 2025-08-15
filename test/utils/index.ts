export * from './wait.utils';
export * from './gesture.utils';
export * from './allure.utils';
export * from './debug.utils';
export * from './platform.utils';
export * from './navigation.utils';
export * from './reset.utils';
export * from './test-isolation.utils';
export * from './keyboard.utils';
export * from './post-login.utils';

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
    attachScreenshot,
    attachScreenshotWithContext,
    attachValidationScreenshot,
    attachScreenshotSequence
} from './allure.utils';

export {
    captureDebugInfo,
    quickDebugCapture
} from './debug.utils';

export {
    isIOS,
    isAndroid,
    getPlatform,
    getPlatformSelector
} from './platform.utils';

export {
    navigateToHomeScreen,
    ensureOnDashboard
} from './navigation.utils';

export {
    clearAppAndActivate,
    reloadSession,
    terminateAndActivateApp,
    resetAppState,
    ResetStrategy
} from './reset.utils';

export {
    hideKeyboard,
    isKeyboardShown,
    waitForKeyboard,
    waitForKeyboardToDisappear,
    typeAndHideKeyboard,
    clearTypeAndHideKeyboard,
    pressEnterKey,
    pressTabKey,
    withKeyboardHidden
} from './keyboard.utils';

export {
    PostLoginUtils
} from './post-login.utils';