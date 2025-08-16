import { getPlatform, isIOS, isAndroid, getPlatformSelector } from '../utils/platform.utils';
import { withErrorHandling, ElementNotFoundError, safeOperation } from '../utils/error.utils';
import { waitForDisplayed, retryClick, retrySetValue, TIMEOUTS } from '../utils/wait.utils';

export default abstract class BaseScreen {
    get platform() {
        return getPlatform();
    }

    get isIOS() {
        return isIOS();
    }

    get isAndroid() {
        return isAndroid();
    }

    protected getElement(selector: string | { android: string; ios: string }) {
        return $(getPlatformSelector(selector));
    }

    protected async safeClick(element: WebdriverIO.Element): Promise<boolean> {
        return await safeOperation(async () => {
            await retryClick(element, { maxRetries: 2 });
            return true;
        }, false) ?? false;
    }

    protected async safeSetValue(element: WebdriverIO.Element, value: string): Promise<boolean> {
        return await safeOperation(async () => {
            await retrySetValue(element, value, { platform: this.platform });
            return true;
        }, false) ?? false;
    }

    protected async waitForElement(element: WebdriverIO.Element, timeout: number = TIMEOUTS.STANDARD, elementName?: string): Promise<boolean> {
        return await withErrorHandling(
            async () => {
                return await waitForDisplayed(element, timeout, false, elementName);
            },
            {
                operation: `Wait for element ${elementName || 'unknown'}`,
                recoverable: true,
                onError: async () => {
                    console.warn(`⚠️ Element not found: ${elementName || element.selector}`);
                }
            }
        );
    }

    protected async verifyElementExists(element: WebdriverIO.Element, elementName?: string): Promise<void> {
        const exists = await safeOperation(async () => element.isExisting(), false);
        if (!exists) {
            throw new ElementNotFoundError(elementName || element.selector as string);
        }
    }
}