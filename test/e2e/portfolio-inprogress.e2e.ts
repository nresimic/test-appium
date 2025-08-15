import { step } from '@wdio/allure-reporter';
import { BottomNavigationScreen, PortfolioScreen } from '../screens';
import { TestUsers } from '../data';
import { 
    // navigateToHomeScreen, 
    attachScreenshot,
    SmartTestIsolation,
    TestIsolationLevel 
} from '../utils';

describe('Portfolio', () => {
    const TEST_MANUAL_ACCOUNT = {
        name: 'Test Savings Account',
        balance: '10000',
        type: 'Savings'
    };

    // const EDITED_ACCOUNT = {
    //     name: 'Updated Savings Account',
    //     balance: '15000',
    //     type: 'Savings'
    // };
    
    const TEST_USER = TestUsers.validUserWithoutBankAcc;

    beforeEach(async () => {
        // Portfolio tests preserve login but reset navigation
        await SmartTestIsolation.prepareForTest(
            TestIsolationLevel.PRESERVE_LOGIN,
            TEST_USER
        );
        
        // Navigate directly to portfolio (we're already at dashboard after smart reset)
        await BottomNavigationScreen.tapPortfolioButton();
    });

    it('Should display net worth card', async () => {
        await step('Verify net worth card is displayed', async () => {
            const isDisplayed = await PortfolioScreen.verifyNetWorthCard();
            expect(isDisplayed).toBe(true);
            
            await attachScreenshot('Net worth card displayed');
        });
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

        // await step('Save account', async () => {
        //     await PortfolioScreen.saveAccount();
        //     // await browser.pause(2000); // Wait for save to complete
        // });

        // await step('Verify account is displayed', async () => {
        //     const accountExists = await PortfolioScreen.verifyAccountExists(TEST_MANUAL_ACCOUNT.name);
        //     expect(accountExists).toBe(true);
            
        //     console.log(`Account "${TEST_MANUAL_ACCOUNT.name}" added successfully`);
            
        //     const screenshot = await browser.takeScreenshot();
        //     await addAttachment('Account added to portfolio', Buffer.from(screenshot, 'base64'), 'image/png');
        // });

        // await step('Verify account group is now displayed', async () => {
        //     const isDisplayed = await PortfolioScreen.verifyAccountGroupDisplayed();
        //     expect(isDisplayed).toBe(true);
        // });
    });

    // it('Should edit a manual account', async () => {
    //     await step('Tap on the first account', async () => {
    //         await PortfolioScreen.tapFirstAccount();
    //     });

    //     await step('Tap edit button', async () => {
    //         await PortfolioScreen.editAccount();
    //     });

    //     await step('Update account details', async () => {
    //         await PortfolioScreen.fillManualAccountForm(
    //             EDITED_ACCOUNT.name,
    //             EDITED_ACCOUNT.balance
    //         );
            
    //         const screenshot = await browser.takeScreenshot();
    //         await addAttachment('Account details updated', Buffer.from(screenshot, 'base64'), 'image/png');
    //     });

    //     await step('Save changes', async () => {
    //         await PortfolioScreen.saveAccount();
    //         await browser.pause(2000);
    //     });

    //     await step('Verify account is updated', async () => {
    //         const accountExists = await PortfolioScreen.verifyAccountExists(EDITED_ACCOUNT.name);
    //         expect(accountExists).toBe(true);
            
    //         console.log(`Account updated to "${EDITED_ACCOUNT.name}"`);
            
    //         const screenshot = await browser.takeScreenshot();
    //         await addAttachment('Account updated successfully', Buffer.from(screenshot, 'base64'), 'image/png');
    //     });
    // });

    // it('Should link a bank account', async () => {
    //     await step('Tap add account button', async () => {
    //         await PortfolioScreen.tapAddAccount();
    //     });

    //     await step('Select link bank account option', async () => {
    //         // There's no direct link bank account method, using the link flow
    //         await PortfolioScreen.tapLinkYourAccounts();
    //     });

    //     await step('Handle bank linking flow', async () => {
    //         // This will depend on your bank linking implementation
    //         // For now, we'll just verify we get to the bank selection screen
    //         const linkBankScreen = await LinkBankScreen.linkBankAccount;
    //         const isDisplayed = await linkBankScreen.isDisplayed();
            
    //         if (isDisplayed) {
    //             console.log('Bank linking screen displayed');
    //             const screenshot = await browser.takeScreenshot();
    //             await addAttachment('Bank linking screen', Buffer.from(screenshot, 'base64'), 'image/png');
                
    //             // Skip for now as we don't have test bank credentials
    //             await browser.back();
    //         }
    //     });
    // });

    // it('Should delete an account and remove its transactions', async () => {
    //     // First, create a test account if it doesn't exist
    //     await step('Ensure test account exists', async () => {
    //         const accountExists = await PortfolioScreen.verifyAccountExists(EDITED_ACCOUNT.name);
            
    //         if (!accountExists) {
    //             await PortfolioScreen.tapAddAccount();
    //             await PortfolioScreen.selectAddAccountManually();
    //             await PortfolioScreen.fillManualAccountForm(
    //                 EDITED_ACCOUNT.name,
    //                 EDITED_ACCOUNT.balance
    //             );
    //             await PortfolioScreen.saveAccount();
    //             await browser.pause(2000);
    //         }
    //     });

    //     await step('Navigate to transactions to verify initial state', async () => {
    //         await BottomNavigationScreen.tapTransactionsButton();
            
    //         // Take note of current transaction count
    //         const screenshot = await browser.takeScreenshot();
    //         await addAttachment('Transactions before delete', Buffer.from(screenshot, 'base64'), 'image/png');
            
    //         await BottomNavigationScreen.tapPortfolioButton();
    //     });

    //     await step('Tap on the account to delete', async () => {
    //         await PortfolioScreen.tapFirstAccount();
    //     });

    //     await step('Delete the account', async () => {
    //         await PortfolioScreen.deleteAccount();
    //         await browser.pause(2000);
            
    //         console.log('Account deleted');
    //     });

    //     await step('Verify account is removed', async () => {
    //         const accountExists = await PortfolioScreen.verifyAccountExists(EDITED_ACCOUNT.name);
    //         expect(accountExists).toBe(false);
            
    //         const screenshot = await browser.takeScreenshot();
    //         await addAttachment('Account removed from portfolio', Buffer.from(screenshot, 'base64'), 'image/png');
    //     });

    //     await step('Verify transactions are also removed', async () => {
    //         await BottomNavigationScreen.tapTransactionsButton();
            
    //         // Verify the transactions related to the deleted account are gone
    //         const screenshot = await browser.takeScreenshot();
    //         await addAttachment('Transactions after delete', Buffer.from(screenshot, 'base64'), 'image/png');
    //     });
    // });

    // it('Should deactivate an account but retain transactions', async () => {
    //     // First, create a test account
    //     await step('Create test account for deactivation', async () => {
    //         await PortfolioScreen.tapAddAccount();
    //         await PortfolioScreen.selectAddAccountManually();
    //         await PortfolioScreen.fillManualAccountForm(
    //             'Account to Deactivate',
    //             '5000'
    //         );
    //         await PortfolioScreen.saveAccount();
    //         await browser.pause(2000);
    //     });

    //     await step('Navigate to transactions to note initial state', async () => {
    //         await BottomNavigationScreen.tapTransactionsButton();
            
    //         const screenshot = await browser.takeScreenshot();
    //         await addAttachment('Transactions before deactivation', Buffer.from(screenshot, 'base64'), 'image/png');
            
    //         await BottomNavigationScreen.tapPortfolioButton();
    //     });

    //     await step('Tap on the account to deactivate', async () => {
    //         const account = await PortfolioScreen.getAccountByName('Account to Deactivate');
    //         await account.click();
    //     });

    //     await step('Deactivate the account', async () => {
    //         await PortfolioScreen.deactivateAccount();
    //         await browser.pause(2000);
            
    //         console.log('Account deactivated');
    //     });

    //     await step('Verify account is removed from portfolio', async () => {
    //         const accountExists = await PortfolioScreen.verifyAccountExists('Account to Deactivate');
    //         expect(accountExists).toBe(false);
            
    //         const screenshot = await browser.takeScreenshot();
    //         await addAttachment('Account removed after deactivation', Buffer.from(screenshot, 'base64'), 'image/png');
    //     });

    //     await step('Verify transactions are retained', async () => {
    //         await BottomNavigationScreen.tapTransactionsButton();
            
    //         // The transactions should still be visible even though account is deactivated
    //         const screenshot = await browser.takeScreenshot();
    //         await addAttachment('Transactions retained after deactivation', Buffer.from(screenshot, 'base64'), 'image/png');
    //     });
    // });

    // it('Should re-link same accounts after deleting all bank accounts', async () => {
    //     await step('Note current portfolio state', async () => {
    //         const screenshot = await browser.takeScreenshot();
    //         await addAttachment('Initial portfolio state', Buffer.from(screenshot, 'base64'), 'image/png');
    //     });

    //     // This test would need actual bank account linking to be fully implemented
    //     await step('Delete all existing bank accounts', async () => {
    //         // Implementation would go here when bank linking is available
    //         console.log('Bank account deletion and re-linking test placeholder');
    //     });

    //     await step('Re-link the same bank accounts', async () => {
    //         // Implementation would go here when bank linking is available
    //         console.log('Re-linking test placeholder');
    //     });
    // });
});