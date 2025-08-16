import BottomNavigationScreen from '../screens/navigation/bottom-navigation.screen';
import MenuScreen from '../screens/navigation/menu.screen';
import WelcomeScreen from '../screens/auth/welcome.screen';
import { scrollToElementMobile } from '../utils/gesture.utils';
import { withErrorHandling } from '../utils/error.utils';

export class LogoutFlow {
    static async logout() {
        return await withErrorHandling(
            async () => {
                await BottomNavigationScreen.tapMenuButton();
                const signOutButton = await MenuScreen.signOutButton;
                await scrollToElementMobile(signOutButton, 'Sign out');
                await MenuScreen.performLogout();
                await WelcomeScreen.waitForScreen();
                return await WelcomeScreen.isScreenDisplayed();
            },
            {
                operation: 'Logout flow',
                recoverable: true,
                fallback: async () => {
                    console.log('🔄 Attempting fallback logout via app restart');
                    await driver.reloadSession();
                    await WelcomeScreen.waitForScreen();
                    return await WelcomeScreen.isScreenDisplayed();
                }
            }
        );
    }
}