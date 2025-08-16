/**
 * Test tagging utilities for WebDriverIO tests using Mocha grep functionality
 * 
 * Usage: Add tags directly to test descriptions:
 * it('Should login successfully @ios @smoke @auth', async () => {})
 * 
 * Filter tests with:
 * --mochaOpts.grep="@ios" (run only iOS tests)
 * --mochaOpts.grep="@smoke" (run only smoke tests)
 * --mochaOpts.grep="@ios.*@smoke" (run tests with both tags)
 */

/**
 * Available test tags for easy reference
 */
export const TAGS = {
    IOS: '@ios',
    ANDROID: '@android', 
    SMOKE: '@smoke',
    REGRESSION: '@regression',
    CRITICAL: '@critical',
    AUTH: '@auth',
    BANKING: '@banking',
    PORTFOLIO: '@portfolio',
    SETTINGS: '@settings'
} as const;

/**
 * Generate grep pattern for multiple tags
 * Examples:
 * - generateGrepPattern(['@ios']) => "@ios"
 * - generateGrepPattern(['@ios', '@smoke']) => "@ios.*@smoke"
 * - generateGrepPattern(['@ios', '@smoke'], 'OR') => "@ios|@smoke"
 */
export function generateGrepPattern(tags: string[], logic: 'AND' | 'OR' = 'AND'): string {
    if (tags.length === 0) return '';
    if (tags.length === 1) return tags[0];
    
    if (logic === 'OR') {
        return tags.join('|');
    } else {
        return tags.join('.*');
    }
}