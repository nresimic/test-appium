import WelcomeScreen from '../screens/auth/welcome.screen';
import AuthScreen from '../screens/auth/auth.screen';
import { TestUser } from '../data/test-users';
import { PostLoginUtils } from '../utils';
import { withErrorHandling } from '../utils/error.utils';

export class LoginFlow {
    
    static async login(user: TestUser) {
        return await withErrorHandling(
            async () => {
                await WelcomeScreen.waitForScreen();
                await WelcomeScreen.tapLoginButton();
                await AuthScreen.performLogin(user);
                await PostLoginUtils.waitForPostLoginScreen();
            },
            {
                operation: 'Login flow',
                recoverable: false
            }
        );
    }
    static async navigateToLoginScreen() {
        return await withErrorHandling(
            async () => {
                await WelcomeScreen.waitForScreen();
                await WelcomeScreen.tapLoginButton();
            },
            {
                operation: 'Navigate to login screen',
                recoverable: true
            }
        );
    }
    
    static async passcodeReauth(user: TestUser) {
        return await withErrorHandling(
            async () => {
                console.log('🔐 Performing passcode re-authentication...');
                await AuthScreen.performPasscodeReauth(user.passcode);
                await PostLoginUtils.waitForPostLoginScreen();
            },
            {
                operation: 'Passcode re-authentication',
                recoverable: false
            }
        );
    }
}