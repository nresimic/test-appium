import BaseScreen from './base.screen';
import { waitForDisplayed } from '../utils/wait.utils';
import { getDynamicSelector } from 'test/utils/selector.utils';

class PortfolioScreen extends BaseScreen {
    // Net worth elements
    get netWorthCard() {
        return this.getElement('~Net worth');
    }


    // Account group elements
    get accountGroupEmpty() {
        return this.getElement('~No accounts added');
    }

    get accountGroup() {
        return this.getElement('~Account group');
    }

    // Add account elements - Two different buttons
    get addAccountButton() {
        return this.getElement('~Add account');
    }

    get linkYourAccountsButton() {
        return this.getElement('~Link your accounts');
    }

    // Account type selection screen
    get selectAccountTypeLabel() {
        return this.getElement('~Select account type');
    }

    // Account type options
    get uaeBanksOption() {
        return this.getElement('~UAE Banks');
    }

    get cashOption() {
        return this.getElement('~Cash');
    }

    get depositsOption() {
        return this.getElement('~Deposits');
    }

    get homeOption() {
        return this.getElement('~Home');
    }

    get investmentsOption() {
        return this.getElement('~Investments');
    }

    get loanOption() {
        return this.getElement('~Loan');
    }

    get realEstateOption() {
        return this.getElement('~Real estate');
    }

    get retirementFundOption() {
        return this.getElement('~Retirement fund');
    }

    get somethingElseOption() {
        return this.getElement('~Something else');
    }

    // UAE Banks modal options
    get linkYourAccountOption() {
        return this.getElement('~Link your account');
    }

    get addAccountManuallyOption() {
        return this.getElement('~Add a manual account');
    }

    // Have/Owe selection
    get haveOption() {
        return this.getElement('~Have');
    }

    get oweOption() {
        return this.getElement('~Owe');
    }

    // Choose account type label
    get chooseAccountTypeLabel() {
        return this.getElement('~Choose an account type');
    }

    // Next button for account type selection
    get nextButton() {
        return this.getElement('~Next');
    }

    // Manual account form elements
    get accountNameInput() {
        return this.getElement({
            android: 'android=new UiSelector().className("android.widget.EditText").instance(0)',
            ios: '~Account name'
        });
    }

    get accountBalanceInput() {
        return this.getElement({
            android: 'android=new UiSelector().className("android.widget.EditText").instance(1)',
            ios: '~Balance'
        });
    }

    get accountTypeDropdown() {
        return this.getElement('~Account type');
    }

    get saveAccountButton() {
        return this.getElement('~Save');
    }

    get cancelButton() {
        return this.getElement('~Cancel');
    }

    // Account list elements
    get firstAccount() {
        return this.getElement({
            android: 'android=new UiSelector().className("android.view.ViewGroup").instance(0)',
            ios: '(//XCUIElementTypeOther[@name="account-item"])[1]'
        });
    }

    // Account actions
    get editAccountButton() {
        return this.getElement('~Edit');
    }

    get deleteAccountButton() {
        return this.getElement('~Delete');
    }

    get deactivateAccountButton() {
        return this.getElement('~Deactivate');
    }

    get confirmDeleteButton() {
        return this.getElement('~Confirm delete');
    }

    get confirmDeactivateButton() {
        return this.getElement('~Confirm deactivate');
    }

    async verifyNetWorthCard() {
        const card = await this.netWorthCard;
        await waitForDisplayed(card);
        return await card.isDisplayed();
    }


    async verifyEmptyAccountGroup() {
        const emptyGroup = await this.accountGroupEmpty;
        return await emptyGroup.isDisplayed();
    }

    async verifyAccountGroupDisplayed() {
        const group = await this.accountGroup;
        return await group.isDisplayed();
    }

    async verifyAddAccountButton() {
        const button = await this.addAccountButton;
        await waitForDisplayed(button);
        return await button.isDisplayed();
    }

    async tapAddAccount() {
        const button = await this.addAccountButton;
        await button.click();
    }

    async tapLinkYourAccounts() {
        const button = await this.linkYourAccountsButton;
        await button.click();
    }

    async selectAccountType(type: string) {
        const typeElement = await this.getElement(`~${type}`);
        await waitForDisplayed(typeElement);
        await typeElement.click();
    }

    async selectUAEBanks() {
        const option = await this.uaeBanksOption;
        await waitForDisplayed(option);
        await option.click();
    }

    async selectAddAccountManually() {
        const option = await this.addAccountManuallyOption;
        await waitForDisplayed(option);
        await option.click();
    }

    async selectHaveOrOwe(option: 'Have' | 'Owe') {
        const element = option === 'Have' ? await this.haveOption : await this.oweOption;
        await waitForDisplayed(element);
        await element.click();
    }

    async selectDetailedAccountType(type: string) {
        // For detailed account types after Have/Owe selection
        const typeElement = await this.getElement(`~${type}`);
        await waitForDisplayed(typeElement);
        await typeElement.click();
    }

    async tapNext() {
        const button = await this.nextButton;
        await waitForDisplayed(button);
        await button.click();
    }

    async fillManualAccountForm(name: string, value: string) {
        // Fill account name
        const nameInput = await this.accountNameInput;
        await waitForDisplayed(nameInput);
        await nameInput.click();
        await nameInput.clearValue();
        await nameInput.setValue(name);

        // Fill account value
        const valueInput = await this.accountBalanceInput;
        await waitForDisplayed(valueInput);
        await valueInput.click();
        await valueInput.clearValue();
        await valueInput.setValue(value);
    }

    async saveAccount() {
        // Updated to use "Add account" instead of "Save"
        const addButton = await this.getElement('~Add account');
        await waitForDisplayed(addButton);
        await addButton.click();
    }

    // Complete flow for adding manual account through "Link your accounts"
    async addManualAccountViaLinkFlow(accountType: string, haveOrOwe: 'Have' | 'Owe', detailedType: string, name: string, value: string) {
        // Tap Link your accounts button
        await this.tapLinkYourAccounts();
        
        // Wait for account type selection screen
        await waitForDisplayed(await this.selectAccountTypeLabel);
        
        // Select account type
        if (accountType === 'UAE Banks') {
            await this.selectUAEBanks();
            // Select manual option from modal
            await this.selectAddAccountManually();
        } else {
            await this.selectAccountType(accountType);
        }
        
        // Select Have or Owe
        await this.selectHaveOrOwe(haveOrOwe);
        
        // Wait for detailed type selection
        await waitForDisplayed(await this.chooseAccountTypeLabel);
        
        // Select detailed account type
        await this.selectDetailedAccountType(detailedType);
        
        // Tap Next
        await this.tapNext();
        
        // Fill manual account form
        await this.fillManualAccountForm(name, value);
        
        // Save account
        await this.saveAccount();
    }

    async tapFirstAccount() {
        const account = await this.firstAccount;
        await waitForDisplayed(account);
        await account.click();
    }

    async editAccount() {
        const editButton = await this.editAccountButton;
        await waitForDisplayed(editButton);
        await editButton.click();
    }

    async deleteAccount() {
        const deleteButton = await this.deleteAccountButton;
        await waitForDisplayed(deleteButton);
        await deleteButton.click();

        const confirmButton = await this.confirmDeleteButton;
        await waitForDisplayed(confirmButton);
        await confirmButton.click();
    }

    async deactivateAccount() {
        const deactivateButton = await this.deactivateAccountButton;
        await waitForDisplayed(deactivateButton);
        await deactivateButton.click();

        const confirmButton = await this.confirmDeactivateButton;
        await waitForDisplayed(confirmButton);
        await confirmButton.click();
    }

    async getAccountByName(name: string) {
        return this.getElement(getDynamicSelector(name));
    }

    async verifyAccountExists(name: string) {
        const account = await this.getAccountByName(name);
        try {
            await waitForDisplayed(account, 10000, false, `Account "${name}"`);
            return true;
        } catch (error) {
            console.log(`Account "${name}" not found or not displayed`);
            return false;
        }
    }
}

export default new PortfolioScreen();