export enum SwipeDirection {
    UP = 'up',
    DOWN = 'down',
    LEFT = 'left',
    RIGHT = 'right'
}

export async function swipe(direction: SwipeDirection) {
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

export async function scrollToElement(selector: string, maxScrolls: number = 5) {
    for (let i = 0; i < maxScrolls; i++) {
        if (await $(selector).isDisplayed()) {
            return true;
        }
        await swipe(SwipeDirection.UP);
    }
    return false;
}

export async function scrollToElementWithDirection(
    selector: string, 
    direction: SwipeDirection = SwipeDirection.UP,
    maxScrolls: number = 5
) {
    for (let i = 0; i < maxScrolls; i++) {
        if (await $(selector).isDisplayed()) {
            return true;
        }
        await swipe(direction);
    }
    return false;
}

export async function swipeUp() {
    await swipe(SwipeDirection.UP);
}

export async function swipeDown(){
    await swipe(SwipeDirection.DOWN);
}

export async function swipeLeft() {
    await swipe(SwipeDirection.LEFT);
}

export async function swipeRight() {
    await swipe(SwipeDirection.RIGHT);
}

export async function scrollToElementMobile(element: WebdriverIO.Element, iosLabelText: string) {
    const isIOS = driver.capabilities.platformName === 'iOS';
    
    if (isIOS) {
        try {
            await driver.execute('mobile: scroll', {
                direction: 'down',
                predicateString: `label == "${iosLabelText}"`
            });
        } catch (e: any) {
            console.log('Scroll not needed or failed:', e.message);
        }
    } else {
        await element.scrollIntoView();
    }
}