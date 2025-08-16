import WelcomeScreen from '../screens/auth/welcome.screen';
import AuthScreen from '../screens/auth/auth.screen';
import LinkBankScreen from '../screens/link-bank.screen';
import { TestUser } from '../data/test-users';
import { PostLoginUtils } from 'test/utils';
import { withErrorHandling } from '../utils/error.utils';

export class RegistrationFlow {

    static async registerNewUserWithoutAddingBankAccount(user: TestUser) {
        return await withErrorHandling(
            async () => {
                await WelcomeScreen.waitForScreen();
                await WelcomeScreen.tapLoginButton();
                await AuthScreen.performRegistration(user);
                await PostLoginUtils.waitForPostLoginScreen();
                return await AuthScreen.verifyDashboard();
            },
            {
                operation: 'Registration without bank account',
                recoverable: false
            }
        );
    }

    // static async registerNewUserWithAddingBankAccount(user: TestUser) {
    //     await WelcomeScreen.waitForScreen();

    //     await WelcomeScreen.tapLoginButton();
        
    //     await AuthScreen.performRegistration(user);
    //     await PostLoginUtils.waitForPostLoginScreen();
        
    //     // TODO: Implement actual bank linking instead of skip
    //     await LinkBankScreen.skipBankLinking();
        

    //     return await AuthScreen.verifyDashboard();
    // }

    static async registerNewUserWithBankLinking(user: TestUser, bankUsername: string, bankPassword: string) {
        return await withErrorHandling(
            async () => {
                await WelcomeScreen.waitForScreen();
                await WelcomeScreen.tapLoginButton();
                await AuthScreen.performRegistration(user);
                await PostLoginUtils.waitForPostLoginScreen();
                await LinkBankScreen.linkBankAccount(bankUsername, bankPassword);
            },
            {
                operation: 'Registration with bank linking',
                recoverable: false
            }
        );
    }

    static async navigateToRegistration() {
        return await withErrorHandling(
            async () => {
                await WelcomeScreen.waitForScreen();
                await WelcomeScreen.tapLoginButton();
            },
            {
                operation: 'Navigate to registration',
                recoverable: true
            }
        );
    }
    
}