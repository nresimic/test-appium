import WelcomeScreen from '../screens/auth/welcome.screen';
import AuthScreen from '../screens/auth/auth.screen';
import LinkBankScreen from '../screens/link-bank.screen';
import { TestUser } from '../data/test-users';
import { PostLoginUtils } from 'test/utils';

export class RegistrationFlow {

    static async registerNewUserWithoutAddingBankAccount(user: TestUser) {
        await WelcomeScreen.waitForScreen();
        await WelcomeScreen.tapLoginButton();
        await AuthScreen.performRegistration(user);

        await LinkBankScreen.skipBankLinking();
        return await AuthScreen.verifyDashboard();
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
        await WelcomeScreen.waitForScreen();
        await WelcomeScreen.tapLoginButton();
        await AuthScreen.performRegistration(user);
        await PostLoginUtils.waitForPostLoginScreen();
        
        await LinkBankScreen.linkBankAccount(bankUsername, bankPassword);
    }

    static async navigateToRegistration() {
        await WelcomeScreen.waitForScreen();
        await WelcomeScreen.tapLoginButton();
    }
    
}