import { isAndroid } from './platform.utils';

/**
 * Creates a selector for elements with dynamic accessibility IDs
 * Handles cases where the accessibility ID contains dynamic values like "Nickname\nVictor"
 * 
 * @param labelPrefix - The static part of the label (e.g., "Nickname", "First name")
 * @returns Platform-specific selector that matches elements starting with the prefix
 */
export function getDynamicSelector(labelPrefix: string): string {
    if (isAndroid()) {
        // Android: Use UiSelector with descriptionContains for accessibility labels
        // This handles content-desc attribute which is used for accessibility
        return `android=new UiSelector().descriptionContains("${labelPrefix}")`;
    }
    // iOS: Use predicate string with BEGINSWITH for partial matching
    return `-ios predicate string:label BEGINSWITH "${labelPrefix}"`;
}
/**
 * Creates a platform-specific selector based on element type
 * 
 * @param androidSelector - Selector for Android
 * @param iosSelector - Selector for iOS
 * @returns Platform-specific selector
 */
export function getPlatformSelector(androidSelector: string, iosSelector: string): string {
    return isAndroid() ? androidSelector : iosSelector;
}

/**
 * Creates a selector for text that might appear in different attributes
 * Useful when text might be in label, text, or content-desc
 * 
 * @param text - The text to search for
 * @param exact - Whether to match exactly or use contains
 * @returns Platform-specific selector
 */
export function getTextSelector(text: string, exact: boolean = false): string {
    if (isAndroid()) {
        return exact 
            ? `android=new UiSelector().text("${text}")`
            : `android=new UiSelector().textContains("${text}")`;
    }
    return exact
        ? `-ios predicate string:label == "${text}"`
        : `-ios predicate string:label CONTAINS "${text}"`;
}