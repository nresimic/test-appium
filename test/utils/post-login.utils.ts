import BottomNavigationScreen from '../screens/navigation/bottom-navigation.screen';
import LinkBankScreen from '../screens/link-bank.screen';
import { smartWait, TIMEOUTS } from './wait.utils';

export class PostLoginUtils {
    /**
     * Waits for post-login screen (Dashboard or Link Bank) and handles appropriately
     * Used by both login and registration flows
     * 
     * @param skipLinkBank - If true, automatically skips Link Bank screen (default: true)
     */
    static async waitForPostLoginScreen(skipLinkBank: boolean = true) {
        console.log('⏳ Waiting for post-login screen (Dashboard or Link Bank)...');
        
        // Use smartWait with condition instead of manual while loop
        await smartWait(
            async () => {
                // Check both in parallel
                const [isDashboardVisible, isLinkBankVisible] = await Promise.all([
                    BottomNavigationScreen.dashboardButton.isDisplayed().catch(() => false),
                    LinkBankScreen.maybeLaterButton.isDisplayed().catch(() => false)
                ]);
                
                // Dashboard appeared - we're done!
                if (isDashboardVisible) {
                    console.log('✅ Dashboard displayed - login complete');
                    return true;
                }
                
                // Link Bank appeared
                if (isLinkBankVisible) {
                    if (skipLinkBank) {
                        console.log('🏦 Link Bank screen appeared - skipping...');
                        await LinkBankScreen.skipBankLinking();
                        
                        // Now wait for dashboard
                        await BottomNavigationScreen.dashboardButton.waitForDisplayed({
                            timeout: TIMEOUTS.STANDARD,
                            timeoutMsg: 'Dashboard not displayed after skipping Link Bank'
                        });
                        return true;
                    } else {
                        console.log('🏦 Link Bank screen appeared - ready for bank linking');
                        return true;
                    }
                }
                
                // Neither found yet
                return false;
            },
            {
                timeout: TIMEOUTS.LOGIN,  // Use our defined LOGIN timeout
                interval: TIMEOUTS.POLLING_INTERVAL,
                message: 'Login failed: Neither Dashboard nor Link Bank screen appeared'
            }
        );
    }
}