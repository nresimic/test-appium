import BottomNavigationScreen from '../screens/navigation/bottom-navigation.screen';
import { smartWait, TIMEOUTS } from './wait.utils';

export async function navigateToHomeScreen(maxAttempts: number = 5) {
    const menuButton = await BottomNavigationScreen.menuButton;
    
    if (await menuButton.isDisplayed()) {
        return true;
    }
    
    for (let i = 0; i < maxAttempts; i++) {
        await browser.back();
        await smartWait(TIMEOUTS.ANIMATION);
        
        if (await menuButton.isDisplayed()) {
            console.log(`Found home screen after ${i + 1} back navigation(s)`);
            return true;
        }
    }
    
    console.log('Could not navigate to home screen');
    return false;
}

export async function ensureOnDashboard() {
    const onHome = await navigateToHomeScreen();
    if (!onHome) {
        return false;
    }
    
    await BottomNavigationScreen.tapDashboardButton();
    return true;
}