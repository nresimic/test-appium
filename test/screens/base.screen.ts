import { getPlatform, isIOS, isAndroid, getPlatformSelector } from '../utils/platform.utils';


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

    protected async isDisplayed(element: WebdriverIO.Element) {
        try {
            return await element.isDisplayed();
        } catch {
            return false;
        }
    }

    protected async isExisting(element: WebdriverIO.Element) {
        try {
            return await element.isExisting();
        } catch {
            return false;
        }
    }

    protected async isScreenDisplayed() {
        return true;
    }
}