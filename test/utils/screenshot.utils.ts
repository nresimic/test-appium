/**
 * Screenshot utility functions for WebdriverIO tests
 * Extracted from BaseScreen following 2024 best practices
 */

/**
 * Take a screenshot with standardized naming convention
 */
export async function takeScreenshot(name: string): Promise<string> {
    const platform = (driver.capabilities.platformName as string)?.toLowerCase() || 'unknown';
    const timestamp = Date.now();
    const fileName = `${platform}-${name}-${timestamp}.png`;
    const filePath = `./reports/screenshots/${fileName}`;
    
    await driver.saveScreenshot(filePath);
    console.log(`Screenshot saved: ${filePath}`);
    
    return fileName;
}

/**
 * Take screenshot and return as base64 string for test reports
 */
export async function takeScreenshotAsBase64(): Promise<string> {
    return await browser.takeScreenshot();
}

/**
 * Take screenshot with automatic test step naming
 * Uses the current test title if available
 */
export async function takeScreenshotForCurrentTest(): Promise<string> {
    // Try to get current test name from global context
    const testName = (global as any).currentTest?.title || 'test-step';
    const sanitizedName = testName.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50);
    
    return await takeScreenshot(sanitizedName);
}

/**
 * Take screenshot on test failure with error context
 */
export async function takeFailureScreenshot(errorMessage?: string): Promise<string> {
    const errorContext = errorMessage ? errorMessage.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 30) : 'failure';
    return await takeScreenshot(`failure-${errorContext}`);
}

/**
 * Ensure screenshots directory exists
 */
export async function ensureScreenshotDirectory(): Promise<void> {
    const fs = require('fs');
    const path = require('path');
    
    const screenshotDir = path.join(process.cwd(), 'reports', 'screenshots');
    
    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
        console.log(`Created screenshot directory: ${screenshotDir}`);
    }
}