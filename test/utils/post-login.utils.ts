import BottomNavigationScreen from '../screens/navigation/bottom-navigation.screen';
import LinkBankScreen from '../screens/link-bank.screen';
import { smartWait, TIMEOUTS, getAdjustedTimeout } from './wait.utils';

export class PostLoginUtils {
    
    static async waitForSpecificScreen(screenName: 'dashboard' | 'linkbank', timeout?: number) {
        const adjustedTimeout = timeout || getAdjustedTimeout('LOGIN');
        const pollInterval = TIMEOUTS.POLLING_INTERVAL;
        
        console.log(`⏳ Waiting specifically for ${screenName} screen...`);
        
        await smartWait(
            async () => {
                if (screenName === 'dashboard') {
                    return await BottomNavigationScreen.dashboardButton.isDisplayed().catch(() => false);
                } else {
                    return await LinkBankScreen.maybeLaterButton.isDisplayed().catch(() => false);
                }
            },
            {
                timeout: adjustedTimeout,
                interval: pollInterval,
                message: `${screenName} screen not displayed after ${adjustedTimeout}ms`
            }
        );
    }
    /**
     * Waits for post-login screen (Dashboard or Link Bank) and handles appropriately
     * Used by both login and registration flows
     * 
     * @param skipLinkBank - If true, automatically skips Link Bank screen (default: true)
     */
    static async waitForPostLoginScreen(skipLinkBank: boolean = true) {
        console.log('⏳ Waiting for post-login screen (Dashboard or Link Bank)...');
        
        const timeout = getAdjustedTimeout('LOGIN');
        const pollInterval = TIMEOUTS.POLLING_INTERVAL;
        
        await smartWait(
            async () => {
                let isDashboardVisible = false;
                let isLinkBankVisible = false;
                
                try {
                    isDashboardVisible = await BottomNavigationScreen.dashboardButton.isDisplayed();
                    if (isDashboardVisible) {
                        console.log('✅ Dashboard displayed - login complete');
                        return true;
                    }
                } catch (error) {
                    console.log('🔍 Dashboard check failed, checking Link Bank...');
                }
                
                try {
                    await smartWait(200);
                    isLinkBankVisible = await LinkBankScreen.maybeLaterButton.isDisplayed();
                    
                    if (isLinkBankVisible) {
                        if (skipLinkBank) {
                            console.log('🏦 Link Bank screen appeared - skipping...');
                            await LinkBankScreen.skipBankLinking();
                            
                            const dashboardTimeout = TIMEOUTS.STANDARD;
                            await BottomNavigationScreen.dashboardButton.waitForDisplayed({
                                timeout: dashboardTimeout,
                                timeoutMsg: 'Dashboard not displayed after skipping Link Bank'
                            });
                            return true;
                        } else {
                            console.log('🏦 Link Bank screen appeared - ready for bank linking');
                            return true;
                        }
                    }
                } catch (error) {
                    console.log('🔍 Link Bank check failed, continuing to wait...');
                }
                
                return false;
            },
            {
                timeout,
                interval: pollInterval,
                message: `Login failed: Neither Dashboard nor Link Bank screen appeared after ${timeout}ms`
            }
        );
    }
}