import WelcomeScreen from '../screens/auth/welcome.screen';
import AuthScreen from '../screens/auth/auth.screen';
import { TestUser } from '../data/test-users';
import { PostLoginUtils } from '../utils';

export class LoginFlow {
    
    static async login(user: TestUser) {

        await WelcomeScreen.waitForScreen();
        
        await WelcomeScreen.tapLoginButton();
        
        await AuthScreen.performLogin(user);

        await PostLoginUtils.waitForPostLoginScreen();
    }
    static async navigateToLoginScreen() {
        await WelcomeScreen.waitForScreen();
        await WelcomeScreen.tapLoginButton();
    }

    /**
     * Quick login for re-login after logout
     * Uses performQuickLogin which handles the different passcode flow
     */
    static async quickLogin(user: TestUser) {
        await WelcomeScreen.waitForScreen();
        await WelcomeScreen.tapLoginButton();
        await AuthScreen.performQuickLogin(user);
        
        // Use the same post-login screen handling
        await PostLoginUtils.waitForPostLoginScreen();
    }
    
    /**
     * Passcode-only authentication when app remembers the user
     * Handles both Dashboard and Link Bank skip scenarios
     */
    static async passcodeReauth(user: TestUser) {
        console.log('🔐 Performing passcode re-authentication...');
        
        // Enter passcode only (app already knows the user)
        await AuthScreen.performPasscodeReauth(user.passcode);
        
        // Use the same post-login screen handling
        // This will check for both Dashboard and Link Bank skip screen
        await PostLoginUtils.waitForPostLoginScreen();
    }
}