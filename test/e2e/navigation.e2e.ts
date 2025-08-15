import { BottomNavigationScreen, MenuScreen, DashboardScreen, PortfolioScreen, TransactionsScreen, BudgetScreen } from '../screens';
import { TestUsers } from '../data';
import { step } from '@wdio/allure-reporter';
import { 
    SmartTestIsolation,
    TestIsolationLevel 
} from '../utils';

describe('Navigation Tests', () => {
    const TEST_USER = TestUsers.validUserWithoutBankAcc;
    
    before(async () => {
        await SmartTestIsolation.prepareForTest(
            TestIsolationLevel.PRESERVE_STATE,
            TEST_USER
        );
    });

    it('Should display all navigation tabs in the app', async () => {
        await step('Verify Dashboard is displayed', async () => {
            await BottomNavigationScreen.tapDashboardButton();
            await DashboardScreen.verifyStartBuildingPortfolioLabel();
        });
        await step('Verify Portfolio is displayed', async () => {
            await BottomNavigationScreen.tapPortfolioButton();
            await PortfolioScreen.verifyAddAccountButton();
        });
        await step('Verify Transactions is displayed', async () => {
            await BottomNavigationScreen.tapTransactionsButton();
            await TransactionsScreen.verifySearchTransaction();
        });
        await step('Verify Budget is displayed', async () => {
            await BottomNavigationScreen.tapBudgetButton();
            await BudgetScreen.verifyCreateBudgetLabel();
        });
        await step('Verify Menu is displayed', async () => {
            await BottomNavigationScreen.tapMenuButton();
            await MenuScreen.verifyMenuScreen();
        });
    });
});