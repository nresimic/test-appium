import WelcomeScreen from '../screens/welcome.screen';
import AuthScreen from '../screens/auth.screen';
import LinkBankScreen from '../screens/linkBank.screen';
import { TestUsers } from '../data/test-users';
import { addDescription, addSeverity, addOwner } from '@wdio/allure-reporter';
import { Severity } from 'allure-js-commons';

describe('Registration Flow', () => {
    it('Should register a new user successfully', async () => {
        addDescription('Complete registration flow including profile information setup', 'text');
        addSeverity(Severity.CRITICAL);
        addOwner('Mobile QA Team');
        
        // Wait for welcome screen to be ready
        await WelcomeScreen.waitForScreen();
        
        const isAppLaunched = await WelcomeScreen.isScreenDisplayed();
        expect(isAppLaunched).toBe(true);
        
        await WelcomeScreen.tapLoginButton();
        
        await AuthScreen.performRegistration(TestUsers.newUser);
        await LinkBankScreen.skipBankLinking();
        
        const isDashboardDisplayed = await AuthScreen.verifyDashboard();
        expect(isDashboardDisplayed).toBe(true);
    });
    it('Should register a new user successfully and add bank account', async () => {
        addDescription('Complete registration flow including profile information setup', 'text');
        addSeverity(Severity.CRITICAL);
        addOwner('Mobile QA Team');
        
        // Wait for welcome screen to be ready
        await WelcomeScreen.waitForScreen();
        
        const isAppLaunched = await WelcomeScreen.isScreenDisplayed();
        expect(isAppLaunched).toBe(true);
        
        await WelcomeScreen.tapLoginButton();
        
        await AuthScreen.performRegistration(TestUsers.newUser);
        await LinkBankScreen.skipBankLinking();
        
        const isDashboardDisplayed = await AuthScreen.verifyDashboard();
        expect(isDashboardDisplayed).toBe(true);
    });
});