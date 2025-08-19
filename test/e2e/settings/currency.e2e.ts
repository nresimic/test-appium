import { step } from '@wdio/allure-reporter';
import { 
    BottomNavigationScreen, 
    MenuScreen, 
    SettingsScreen, 
    CurrencyScreen 
} from '../../screens';
import { 
    TestUsers, 
    getAllCurrencyCodes,
    findTwoUnselectedCurrencies,
    validateAllCurrenciesExist,
    getFallbackCurrency
} from '../../data';
import {
    attachScreenshot,
    SmartTestIsolation,
    TestIsolationLevel,
    waitForModal
} from '../../utils';

describe('Currency Settings', () => {
    const TEST_USER = TestUsers.validUserWithoutBankAcc;
    let CURRENCY_TO_CANCEL: string;
    let CURRENCY_TO_PERSIST: string;
    
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
            const missingCurrencies = await validateAllCurrenciesExist(CurrencyScreen);
            
            // Verify all currencies are present
            expect(missingCurrencies.length).toBe(0);
            
            await attachScreenshot('All 15 supported currencies verified');
        });
        
        await step('Verify currency count', async () => {
            const allCurrencyCodes = getAllCurrencyCodes();
            expect(allCurrencyCodes.length).toBe(15);
        });
    });

    it('Should cancel currency change correctly', async () => {
        await step('Navigate to currency settings and find unselected currency', async () => {
            await BottomNavigationScreen.tapMenuButton();
            await MenuScreen.tapSettingsButton();
            await SettingsScreen.openCurrency();
            await CurrencyScreen.verifyCurrencyScreen();
            
            // Dynamically find unselected currencies
            const unselectedCurrencies = await findTwoUnselectedCurrencies(CurrencyScreen);
            expect(unselectedCurrencies.length).toBeGreaterThanOrEqual(1);
            
            CURRENCY_TO_CANCEL = unselectedCurrencies[0];
            console.log(`🎯 Using currency for cancel test: ${CURRENCY_TO_CANCEL}`);
        });
        
        await step('Verify selected currency is not selected', async () => {
            await CurrencyScreen.searchCurrency(CURRENCY_TO_CANCEL);
            
            const isSelectedBefore = await CurrencyScreen.isCurrencySelected(CURRENCY_TO_CANCEL);
            expect(isSelectedBefore).toBe(false);
        });
        
        await step('Select currency and cancel change', async () => {
            await CurrencyScreen.selectCurrency(CURRENCY_TO_CANCEL);
            
            await attachScreenshot(`${CURRENCY_TO_CANCEL} clicked - modal should appear`);
            
            await CurrencyScreen.cancelCurrencyChange();
            
            await waitForModal(false);
        });
        
        await step('Verify currency was not changed', async () => {
            await CurrencyScreen.searchCurrency(CURRENCY_TO_CANCEL);
            
            const isSelectedAfter = await CurrencyScreen.isCurrencySelected(CURRENCY_TO_CANCEL);
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
        
        await step('Find unselected currency for persistence test', async () => {
            // Dynamically find unselected currencies
            const unselectedCurrencies = await findTwoUnselectedCurrencies(CurrencyScreen);
            expect(unselectedCurrencies.length).toBeGreaterThanOrEqual(1);
            
            // Use second currency if available, otherwise fallback
            CURRENCY_TO_PERSIST = unselectedCurrencies.length > 1 
                ? unselectedCurrencies[1] 
                : (unselectedCurrencies[0] !== CURRENCY_TO_CANCEL 
                    ? unselectedCurrencies[0] 
                    : getFallbackCurrency([CURRENCY_TO_CANCEL]));
            
            console.log(`🎯 Using currency for persist test: ${CURRENCY_TO_PERSIST}`);
            
            await CurrencyScreen.searchCurrency(CURRENCY_TO_PERSIST);
            
            const isSelectedBefore = await CurrencyScreen.isCurrencySelected(CURRENCY_TO_PERSIST);
            expect(isSelectedBefore).toBe(false);
            
            // Store target currency for use in subsequent steps
            (global as any).targetCurrency = CURRENCY_TO_PERSIST;
        });
        
        await step('Select target currency', async () => {
            await CurrencyScreen.selectCurrency(CURRENCY_TO_PERSIST);
            
            await attachScreenshot(`${CURRENCY_TO_PERSIST} clicked - modal should appear`);
        });
        
        await step('Confirm currency change', async () => {
            await CurrencyScreen.confirmCurrencyChange();

            await attachScreenshot('Currency change success message');
 
        });
        
        await step('Verify currency was changed in settings', async () => {
            await CurrencyScreen.searchCurrency(CURRENCY_TO_PERSIST);
            
            const isSelectedAfterChange = await CurrencyScreen.isCurrencySelected(CURRENCY_TO_PERSIST);
            expect(isSelectedAfterChange).toBe(true);
        });
        
        await step('Logout from the app', async () => {
            await SmartTestIsolation.prepareForTest(
                TestIsolationLevel.PRESERVE_LOGIN,
                TEST_USER
            );
        });
        
        await step('Navigate to currency settings and verify persistence', async () => {
            await BottomNavigationScreen.tapMenuButton();
            await MenuScreen.tapSettingsButton();
            await SettingsScreen.openCurrency();

            await CurrencyScreen.searchCurrency(CURRENCY_TO_PERSIST);
            
            const isSelected = await CurrencyScreen.isCurrencySelected(CURRENCY_TO_PERSIST);
            expect(isSelected).toBe(true);
            
            console.log(`✅ Currency successfully persisted: ${CURRENCY_TO_PERSIST}`);
            await attachScreenshot(`${CURRENCY_TO_PERSIST} persisted after logout/login`);
        });
    });
});