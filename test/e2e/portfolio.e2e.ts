import { step } from '@wdio/allure-reporter';
import { BottomNavigationScreen, PortfolioScreen } from '../screens';
import { TestUsers } from '../data';
import { RegistrationFlow } from '../flows';
import { 
    attachScreenshot,
    SmartTestIsolation,
    TestIsolationLevel,
} from '../utils';

describe('Portfolio', () => {
    const TEST_MANUAL_ACCOUNT = {
        name: 'Test Savings Account',
        balance: '10000',
        type: 'Savings'
    };
    
    
    const TEST_USER = TestUsers.generateNewUser();
    

    beforeEach(async () => {
        await SmartTestIsolation.prepareForTest(
            TestIsolationLevel.FULL_CLEAN,
            TEST_USER
        );
        await RegistrationFlow.registerNewUserWithoutAddingBankAccount(TEST_USER);
        
        await BottomNavigationScreen.tapPortfolioButton();
    });

    it.skip('Should show empty state when no accounts added', async () => {
        await step('Verify empty account group state', async () => {
            const isEmpty = await PortfolioScreen.verifyEmptyAccountGroup();
            expect(isEmpty).toBe(true);
            
            console.log('Account group shows empty state');
            
            await attachScreenshot('Empty account group');
        });

        await step('Verify add account button is displayed', async () => {
            const isDisplayed = await PortfolioScreen.verifyAddAccountButton();
            expect(isDisplayed).toBe(true);
        });
    });

    it.only('Should add a manual account successfully', async () => {
        await step('Tap add account button', async () => {
            await PortfolioScreen.tapAddAccount();
        });

        await step('Select add manual account option', async () => {
            await PortfolioScreen.selectAddAccountManually();
        });

        await step('Select have option', async () => {
            await PortfolioScreen.selectHaveOrOwe('Have');
        });

        await step('Select detailed account type', async () => {
            await PortfolioScreen.selectDetailedAccountType('Bank');
        });

        await step('Tap next button', async () => {
            await PortfolioScreen.tapNext();
        });

        await step('Fill manual account form', async () => {
            await PortfolioScreen.fillManualAccountForm(
                TEST_MANUAL_ACCOUNT.name,
                TEST_MANUAL_ACCOUNT.balance
            );
            
            await attachScreenshot('Manual account form filled');
        });

        await step('Save account', async () => {
            await PortfolioScreen.saveAccount();
            // await browser.pause(2000); // Wait for save to complete
        });

        await step('Verify account is displayed', async () => {
            const accountExists = await PortfolioScreen.verifyAccountExists(TEST_MANUAL_ACCOUNT.name);
            expect(accountExists).toBe(true);
            await browser.pause(12000);
            
            console.log(`Account "${TEST_MANUAL_ACCOUNT.name}" added successfully`);
            
            await attachScreenshot('Account added to portfolio');
        });

        await step('Verify account group is now displayed', async () => {
            // const isDisplayed = await PortfolioScreen.verifyAccountGroupDisplayed();
            // expect(isDisplayed).toBe(true);
        });
    });
});