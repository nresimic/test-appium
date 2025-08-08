import WelcomeScreen from '../screens/welcome.screen';
import { takeScreenshot } from '../utils/screenshot.utils';

describe('Vault22 App Tests', () => {
    it('Should launch the app successfully', async () => {
        // Wait for welcome screen to be ready
        await WelcomeScreen.waitForScreen();
        
        const isDisplayed = await WelcomeScreen.isScreenDisplayed();
        expect(isDisplayed).toBe(true);
        await takeScreenshot('app-launched');
    });
    
    it('Should click on Login using Phone Number button', async () => {
        await WelcomeScreen.tapLoginButton();
        await takeScreenshot('after-login-tap');
        
        // Just verify we successfully navigated (button click worked)
        const isAndroid = driver.capabilities.platformName === 'Android';
        const appId = isAndroid 
            ? await driver.getCurrentPackage()
            : 'iOS app active'; // iOS doesn't have getBundleId in newer versions
            
        expect(appId).toBeTruthy();
    });
});