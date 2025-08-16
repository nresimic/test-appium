import { step } from '@wdio/allure-reporter';
import { LoginFlow, LogoutFlow } from '../../flows';
import { 
    BottomNavigationScreen, 
    MenuScreen, 
    SettingsScreen, 
    CurrencyScreen 
} from '../../screens';
import { TestUsers, getAllCurrencyCodes } from '../../data';
import { 
    navigateToHomeScreen, 
    attachScreenshot,
    SmartTestIsolation,
    TestIsolationLevel,
    smartWait,
    TIMEOUTS,
    waitForModal
} from '../../utils';

describe('Currency Settings', () => {
    const TEST_CURRENCY = 'EUR';
    const ALTERNATIVE_CURRENCY = 'SAR';
    const DEFAULT_CURRENCY = 'AED';
    const TEST_USER = TestUsers.validUserWithoutBankAcc;
    
    beforeEach(async () => {
        await SmartTestIsolation.prepareForTest(
            TestIsolationLevel.PRESERVE_LOGIN,
            TEST_USER
        );
    });

    it('Should display all 15 supported currencies', async () => {
        await step('Navigate to currency settings', async () => {
            await BottomNavigationScreen.tapMenuButton();
            await MenuScreen.tapSettingsButton();
            await SettingsScreen.openCurrency();
            await CurrencyScreen.verifyCurrencyScreen();
        });
        
        await step('Verify all 15 supported currencies are available', async () => {
            const allCurrencyCodes = getAllCurrencyCodes();
            const missingCurrencies: string[] = [];
            
            for (const currencyCode of allCurrencyCodes) {
                await CurrencyScreen.searchCurrency(currencyCode);
                
                const element = await CurrencyScreen.getCurrencyElement(currencyCode);
                const exists = await element.isExisting();
                
                if (!exists) {
                    missingCurrencies.push(currencyCode);
                }
                
                const searchInput = await CurrencyScreen.searchInput;
                await searchInput.clearValue();
                await smartWait(TIMEOUTS.STABILITY_CHECK);
            }
            
            expect(missingCurrencies.length).toBe(0);
            
            await attachScreenshot('All 15 supported currencies verified');
        });
        
        await step('Verify currency count', async () => {
            const allCurrencyCodes = getAllCurrencyCodes();
            expect(allCurrencyCodes.length).toBe(15);
        });
    });

    it('Should cancel currency change correctly', async () => {
        await step('Navigate to currency settings', async () => {
            await BottomNavigationScreen.tapMenuButton();
            await MenuScreen.tapSettingsButton();
            await SettingsScreen.openCurrency();
            await CurrencyScreen.verifyCurrencyScreen();
        });
        
        await step('Search for alternative currency and verify it is not selected', async () => {
            await CurrencyScreen.searchCurrency(ALTERNATIVE_CURRENCY);
            
            const isSelectedBefore = await CurrencyScreen.isCurrencySelected(ALTERNATIVE_CURRENCY);
            expect(isSelectedBefore).toBe(false);
        });
        
        await step('Select alternative currency and cancel', async () => {
            await CurrencyScreen.selectCurrency(ALTERNATIVE_CURRENCY);
            
            await attachScreenshot(`${ALTERNATIVE_CURRENCY} clicked - modal should appear`);
            
            await CurrencyScreen.cancelCurrencyChange();
            
            await waitForModal(false);
        });
        
        await step('Verify currency was not changed', async () => {
            await CurrencyScreen.searchCurrency(ALTERNATIVE_CURRENCY);
            
            const isSelectedAfter = await CurrencyScreen.isCurrencySelected(ALTERNATIVE_CURRENCY);
            expect(isSelectedAfter).toBe(false);
            
            await attachScreenshot('Currency unchanged after cancel');
        });
    });

    it('Should change currency and persist after logout/login', async () => {
        await step('Navigate to currency settings', async () => {
            await BottomNavigationScreen.tapMenuButton();
            await MenuScreen.tapSettingsButton();
            await SettingsScreen.openCurrency();
            await CurrencyScreen.verifyCurrencyScreen();
        });
        
        await step('Search for USD and verify it is not selected', async () => {
            await CurrencyScreen.searchCurrency(TEST_CURRENCY);
            
            const isSelectedBefore = await CurrencyScreen.isCurrencySelected(TEST_CURRENCY);
            expect(isSelectedBefore).toBe(false);
        });
        
        await step('Select USD currency', async () => {
            await CurrencyScreen.selectCurrency(TEST_CURRENCY);
            
            await attachScreenshot(`${TEST_CURRENCY} clicked - modal should appear`);
        });
        
        await step('Confirm currency change', async () => {
            await CurrencyScreen.confirmCurrencyChange();

            await attachScreenshot('Currency change success message');
 
        });
        
        await step('Verify currency was changed in settings', async () => {
            await CurrencyScreen.searchCurrency(TEST_CURRENCY);
            
            const isSelectedAfterChange = await CurrencyScreen.isCurrencySelected(TEST_CURRENCY);
            expect(isSelectedAfterChange).toBe(true);
        });
        
        await step('Logout from the app', async () => {
            await navigateToHomeScreen();
            
            const logoutSuccess = await LogoutFlow.logout();
            expect(logoutSuccess).toBe(true);
            
            await attachScreenshot('After logout');
        });
        
        await step('Login again with same user', async () => {
            await LoginFlow.quickLogin(TestUsers.validUserWithoutBankAcc);
            
            // Wait for dashboard to be ready after login
            await smartWait(async () => {
                const menuButton = await BottomNavigationScreen.menuButton;
                return await menuButton.isDisplayed().catch(() => false);
            }, { timeout: TIMEOUTS.LOGIN, message: 'Menu button not visible after login' });
        });
        
        await step('Navigate to currency settings and verify', async () => {
            await BottomNavigationScreen.tapMenuButton();
            await MenuScreen.tapSettingsButton();
            await SettingsScreen.openCurrency();

            await CurrencyScreen.searchCurrency(TEST_CURRENCY);
            
            const isSelected = await CurrencyScreen.isCurrencySelected(TEST_CURRENCY);
            expect(isSelected).toBe(true);
            
            await attachScreenshot(`${TEST_CURRENCY} persisted after logout/login`);
        });
    });

    after(async () => {
        // Always reset back to AED for consistency
        // First ensure we're logged in and at a known state
        await SmartTestIsolation.prepareForTest(
            TestIsolationLevel.PRESERVE_LOGIN,
            TEST_USER
        );
        
        // Navigate to currency settings
        await BottomNavigationScreen.tapMenuButton();
        await MenuScreen.tapSettingsButton();
        await SettingsScreen.openCurrency();
        
        await CurrencyScreen.searchCurrency(DEFAULT_CURRENCY);
        const isAedSelected = await CurrencyScreen.isCurrencySelected(DEFAULT_CURRENCY);
        
        if (!isAedSelected) {
            await CurrencyScreen.selectCurrency(DEFAULT_CURRENCY);
            await CurrencyScreen.confirmCurrencyChange();
        }
    });
});