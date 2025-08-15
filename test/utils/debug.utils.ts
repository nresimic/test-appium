import { addAttachment } from '@wdio/allure-reporter';

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

interface DebugContext {
    testName: string;
    testFile?: string;
    error?: Error;
    platform?: string;
    deviceName?: string;
}

export async function captureDebugInfo(context: DebugContext) {
    console.log(`📸 Capturing debug information for failed test: ${context.testName}`);
    
    try {
        // 1. Capture Screenshot
        await captureScreenshot(context.testName);
        
        // 2. Capture Page Source (DOM/XML structure)
        await capturePageSource();
        
        // 3. Capture Device Logs
        await captureDeviceLogs();
        
        // 4. Capture App State
        await captureAppState();
        
        // 5. Capture Test Context
        await captureTestContext(context);
        
        // 6. Capture Element Hierarchy (for the current view)
        await captureVisibleElements();
        
    } catch (error) {
        console.error('Error capturing debug info:', error);
        // Still try to attach what we can
        await addAttachment(
            'Debug Capture Error',
            `Failed to capture some debug information: ${error instanceof Error ? error.message : String(error)}`,
            'text/plain'
        );
    }
}

async function captureScreenshot(_testName: string) {
    try {
        const screenshot = await browser.takeScreenshot();
        const now = new Date();
        const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        
        await addAttachment(
            `📸 Screenshot at failure [${timestamp}]`,
            Buffer.from(screenshot, 'base64'),
            'image/png'
        );
        
        console.log('✅ Screenshot captured');
    } catch (error: unknown) {
        console.error('❌ Failed to capture screenshot:', getErrorMessage(error));
    }
}

async function capturePageSource() {
    try {
        const pageSource = await driver.getPageSource();
        
        // Format XML for better readability
        const formattedSource = formatXML(pageSource);
        
        await addAttachment(
            '📄 Page Source (DOM Structure)',
            formattedSource,
            'text/xml'
        );
        
        console.log('✅ Page source captured');
    } catch (error: unknown) {
        console.error('❌ Failed to capture page source:', getErrorMessage(error));
        await addAttachment(
            '📄 Page Source Error',
            `Could not capture page source: ${getErrorMessage(error)}\nThis is common on iOS when the view is complex.`,
            'text/plain'
        );
    }
}

async function captureDeviceLogs() {
    try {
        const platform = (await browser.capabilities).platformName?.toLowerCase();
        let logs: any[] = [];
        
        if (platform === 'android') {
            // Get Android logcat logs
            try {
                logs = await driver.getLogs('logcat');
                // Filter to last 100 entries for relevance
                logs = logs.slice(-100);
            } catch (e: unknown) {
                console.log('Could not get logcat logs:', getErrorMessage(e));
            }
        } else if (platform === 'ios') {
            // iOS logs are more limited via Appium
            try {
                logs = await driver.getLogs('syslog');
                logs = logs.slice(-100);
            } catch (e: unknown) {
                console.log('Could not get iOS logs:', getErrorMessage(e));
            }
        }
        
        if (logs.length > 0) {
            const formattedLogs = logs.map(log => 
                `[${log.timestamp || 'N/A'}] ${log.level || 'INFO'}: ${log.message}`
            ).join('\n');
            
            await addAttachment(
                '📱 Device Logs (Last 100 entries)',
                formattedLogs,
                'text/plain'
            );
            
            // Also look for errors/crashes in logs
            const errors = logs.filter(log => 
                log.level === 'ERROR' || 
                log.message?.includes('FATAL') ||
                log.message?.includes('Exception') ||
                log.message?.includes('Crash')
            );
            
            if (errors.length > 0) {
                await addAttachment(
                    '🔴 Device Errors/Crashes',
                    errors.map(e => e.message).join('\n'),
                    'text/plain'
                );
            }
        }
        
        console.log('✅ Device logs captured');
    } catch (error: unknown) {
        console.error('❌ Failed to capture device logs:', getErrorMessage(error));
    }
}

async function captureAppState() {
    try {
        const platform = (await browser.capabilities).platformName?.toLowerCase();
        const state: any = {
            platform,
            timestamp: new Date().toISOString(),
            sessionId: browser.sessionId
        };
        
        if (platform === 'android') {
            try {
                state.currentActivity = await (driver as any).getCurrentActivity();
                state.currentPackage = await (driver as any).getCurrentPackage();
            } catch (e) {
                console.log('Could not get Android activity info');
            }
        } else if (platform === 'ios') {
            try {
                // iOS doesn't have activities, but we can get bundle ID
                state.bundleId = await browser.capabilities['appium:bundleId'];
            } catch (e) {
                console.log('Could not get iOS bundle info');
            }
        }
        
        // Get device info
        const caps = await browser.capabilities as any;
        state.deviceName = caps.deviceName;
        state.platformVersion = caps.platformVersion;
        state.automationName = caps.automationName;
        
        // Get orientation
        try {
            state.orientation = await driver.getOrientation();
        } catch (e) {
            // Orientation might not be available
        }
        
        try {
            state.networkConnection = await (driver as any).getNetworkConnection();
        } catch (e) {
            // Network state might not be available
        }
        
        await addAttachment(
            '📊 App State at Failure',
            JSON.stringify(state, null, 2),
            'application/json'
        );
        
        console.log('✅ App state captured');
    } catch (error: unknown) {
        console.error('❌ Failed to capture app state:', getErrorMessage(error));
    }
}

async function captureTestContext(context: DebugContext) {
    try {
        const contextInfo = {
            testName: context.testName,
            testFile: context.testFile,
            timestamp: new Date().toISOString(),
            platform: context.platform,
            deviceName: context.deviceName,
            error: {
                message: context.error?.message,
                stack: context.error?.stack,
                name: context.error?.name
            }
        };
        
        await addAttachment(
            '🔍 Test Context',
            JSON.stringify(contextInfo, null, 2),
            'application/json'
        );
        
        // Also create a human-readable summary
        const summary = `
Test: ${context.testName}
File: ${context.testFile || 'Unknown'}
Time: ${contextInfo.timestamp}
Platform: ${context.platform || 'Unknown'}
Device: ${context.deviceName || 'Unknown'}

Error Type: ${context.error?.name || 'Unknown'}
Error Message: ${context.error?.message || 'No error message'}

Stack Trace:
${context.error?.stack || 'No stack trace available'}
        `.trim();
        
        await addAttachment(
            '📋 Failure Summary',
            summary,
            'text/plain'
        );
        
        console.log('✅ Test context captured');
    } catch (error: unknown) {
        console.error('❌ Failed to capture test context:', getErrorMessage(error));
    }
}

async function captureVisibleElements() {
    try {
        const platform = (await browser.capabilities).platformName?.toLowerCase();
        let elements: any[] = [];
        
        if (platform === 'android') {
            // Find all elements on screen
            elements = await $$('*');
        } else if (platform === 'ios') {
            // iOS XCUITest selector
            elements = await $$('*');
        }
        
        const elementInfo = await Promise.all(
            elements.slice(0, 50).map(async (elem, index) => {
                try {
                    const isDisplayed = await elem.isDisplayed();
                    const isEnabled = await elem.isEnabled();
                    const text = await elem.getText().catch(() => '');
                    const tagName = await elem.getTagName().catch(() => 'unknown');
                    const bounds = await elem.getLocation().catch(() => ({ x: 0, y: 0 }));
                    const size = await elem.getSize().catch(() => ({ width: 0, height: 0 }));
                    
                    return {
                        index,
                        tagName,
                        text: text ? text.substring(0, 50) : '',
                        isDisplayed,
                        isEnabled,
                        bounds,
                        size
                    };
                } catch (e) {
                    return null;
                }
            })
        );
        
        const validElements = elementInfo.filter(e => e !== null);
        
        await addAttachment(
            '🔲 Visible Elements on Screen',
            JSON.stringify(validElements, null, 2),
            'application/json'
        );
        
        // Create a summary of interactive elements
        const interactiveElements = validElements.filter(e => 
            e.isDisplayed && e.isEnabled && (e.text || e.tagName.includes('Button'))
        );
        
        if (interactiveElements.length > 0) {
            const summary = interactiveElements.map(e => 
                `• ${e.tagName}: "${e.text}" at (${e.bounds.x}, ${e.bounds.y})`
            ).join('\n');
            
            await addAttachment(
                '👆 Clickable Elements',
                summary,
                'text/plain'
            );
        }
        
        console.log('✅ Element hierarchy captured');
    } catch (error: unknown) {
        console.error('❌ Failed to capture visible elements:', getErrorMessage(error));
    }
}

function formatXML(xml: string): string {
    try {
        let formatted = '';
        let indent = '';
        const tab = '  ';
        
        xml.split(/>\s*</).forEach(node => {
            if (node.match(/^\/\w/)) {
                indent = indent.substring(tab.length);
            }
            formatted += indent + '<' + node + '>\n';
            if (node.match(/^<?\w[^>]*[^\/]$/)) {
                indent += tab;
            }
        });
        
        return formatted.substring(1, formatted.length - 2);
    } catch (e) {
        // Return original if formatting fails
        return xml;
    }
}

export async function quickDebugCapture(errorMessage: string) {
    try {
        // Just capture the essentials quickly
        const screenshot = await browser.takeScreenshot();
        await addAttachment(
            '🚨 Quick Debug Screenshot',
            Buffer.from(screenshot, 'base64'),
            'image/png'
        );
        
        await addAttachment(
            '🚨 Error Details',
            errorMessage,
            'text/plain'
        );
    } catch (error) {
        console.error('Failed to capture quick debug:', error);
    }
}