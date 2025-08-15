import { WelcomeScreen, AuthScreen } from '../screens';
import { step } from '@wdio/allure-reporter';
import { 
    attachScreenshot,
    SmartTestIsolation,
    TestIsolationLevel 
} from '../utils';

describe('App Launch Tests', () => {
    beforeEach(async () => {
        // App launch tests need clean state for consistent behavior
        await SmartTestIsolation.prepareForTest(TestIsolationLevel.FULL_CLEAN);
    });
    it('Should launch the app successfully', async () => {
        await step('Launch app and verify welcome screen', async () => {
            await WelcomeScreen.waitForScreen();
            
            const isDisplayed = await WelcomeScreen.isScreenDisplayed();
            expect(isDisplayed).toBe(true);
            
            await attachScreenshot('App launched successfully');
        });
        
        await step('Verify welcome screen elements', async () => {
            const loginButton = await WelcomeScreen.loginButton;
            expect(await loginButton.isDisplayed()).toBe(true);
            expect(await loginButton.isEnabled()).toBe(true);
            
        });
    });
    
    it('Should navigate to login screen from welcome', async () => {
        await step('Tap login button', async () => {
            await WelcomeScreen.tapLoginButton();
            
            await attachScreenshot('After login button tap');
        });
        
        await step('Verify navigation was successful', async () => {
            const isAndroid = driver.capabilities.platformName === 'Android';
            const appId = isAndroid 
                ? await driver.getCurrentPackage()
                : 'iOS app active';
                
            expect(appId).toBeTruthy();
            
            const phoneInput = await AuthScreen.phoneInput;
            expect(await phoneInput.isExisting()).toBe(true);
        });
    });
    
    it('Should handle app backgrounding and foregrounding', async () => {
        await step('Launch app', async () => {
            await WelcomeScreen.waitForScreen();
            const isDisplayed = await WelcomeScreen.isScreenDisplayed();
            expect(isDisplayed).toBe(true);
        });
        
        await step('Put app in background', async () => {
            await driver.execute('mobile: backgroundApp', { seconds: 3 });
        });
        
        await step('Verify app returns to foreground correctly', async () => {
            const isDisplayed = await WelcomeScreen.isScreenDisplayed();
            expect(isDisplayed).toBe(true);
            
            await attachScreenshot('App after foregrounding');
        });
    });
});