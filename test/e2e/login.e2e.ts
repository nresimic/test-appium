import WelcomeScreen from '../screens/welcome.screen';
import AuthScreen from '../screens/auth.screen';
import LinkBankScreen from '../screens/linkBank.screen';
import { TestUsers } from '../data/test-users';
import { addDescription, addSeverity, addOwner } from '@wdio/allure-reporter';
import { Severity } from 'allure-js-commons';

describe('Login Flow', () => {
    it('Should login successfully with user having bank account', async () => {
        addDescription('Login flow for existing user with linked bank account', 'text');
        addSeverity(Severity.CRITICAL);
        addOwner('Mobile QA Team');
        
        // Wait for welcome screen to be ready
        await WelcomeScreen.waitForScreen();
        
        const isAppLaunched = await WelcomeScreen.isScreenDisplayed();
        expect(isAppLaunched).toBe(true);
        
        await WelcomeScreen.tapLoginButton();

        await AuthScreen.performLogin(TestUsers.validUserWithBankAcc);

        const isDashboardDisplayed = await AuthScreen.verifyDashboard();
        expect(isDashboardDisplayed).toBe(true);
    });

    it.only('Should login successfully with user without bank account', async () => {
        addDescription('Login flow for existing user without linked bank account', 'text');
        addSeverity(Severity.CRITICAL);
        addOwner('Mobile QA Team');
        
        // Wait for welcome screen to be ready
        await WelcomeScreen.waitForScreen();
        
        const isAppLaunched = await WelcomeScreen.isScreenDisplayed();
        expect(isAppLaunched).toBe(true);
        
        await WelcomeScreen.tapLoginButton();

        await AuthScreen.performLogin(TestUsers.validUserWithoutBankAcc);
        await LinkBankScreen.skipBankLinking();

        const isDashboardDisplayed = await AuthScreen.verifyDashboard();
        expect(isDashboardDisplayed).toBe(true);
    });
});