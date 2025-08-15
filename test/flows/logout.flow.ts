import BottomNavigationScreen from '../screens/navigation/bottom-navigation.screen';
import MenuScreen from '../screens/navigation/menu.screen';
import WelcomeScreen from '../screens/auth/welcome.screen';
import { scrollToElementMobile } from '../utils/gesture.utils';

export class LogoutFlow {
    static async logout() {
        await BottomNavigationScreen.tapMenuButton();
        
        // Scroll to Sign out button using WebdriverIO's scrollIntoView for Android
        const signOutButton = await MenuScreen.signOutButton;
        await scrollToElementMobile(signOutButton, 'Sign out');
        
        await MenuScreen.performLogout();
        
        await WelcomeScreen.waitForScreen();
        
        return await WelcomeScreen.isScreenDisplayed();
    }
}