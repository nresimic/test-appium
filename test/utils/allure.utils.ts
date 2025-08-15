import { addAttachment } from '@wdio/allure-reporter';
import { smartWait } from './wait.utils';


export async function attachScreenshot(name: string) {
    const screenshot = await browser.takeScreenshot();
    await addAttachment(
        name,
        Buffer.from(screenshot, 'base64'),
        'image/png'
    );
}

export async function attachScreenshotWithContext(name: string, context: Record<string, any>) {
    await attachScreenshot(name);
    
    await addAttachment(
        `${name} - Context`,
        JSON.stringify(context, null, 2),
        'application/json'
    );
}


export async function attachValidationScreenshot(elementName: string, status: string = 'validated') {
    await attachScreenshot(`${elementName} - ${status}`);
}

export async function attachScreenshotSequence(screenshots: string[], delayMs: number = 500) {
    for (const [index, name] of screenshots.entries()) {
        if (index > 0) {
            await smartWait(delayMs);
        }
        await attachScreenshot(name);
    }
}