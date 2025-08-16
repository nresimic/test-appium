import BaseScreen from './base.screen';
import {  
    waitForDisplayed,
    waitForSystemModalToDismiss,
    smartWait,
    TIMEOUTS,
    verifyElementDisplayed
} from '../utils/wait.utils';
import { step } from '@wdio/allure-reporter';
import { getDynamicSelector } from '../utils/selector.utils';
import { safeOperation } from '../utils/error.utils';

class LinkBank extends BaseScreen {
    get selectBankButton() {
        return this.getElement('~Select your bank');
    }

    get maybeLaterButton() {
        return this.getElement('~Maybe later');
    }

    get continueToSkipButton() {
        return this.getElement('~Continue to skip');
    }

    get linkYourAccountsButton() {
        return this.getElement('~Link your accounts');
    }

    get uaeBanksOption() {
        return this.getElement('~UAE Banks');
    }

    get linkAccountModalButton() {
        return this.getElement('~Link your account');
    }

    get leanMockbankTwo() {
        return this.getElement('~Lean Mockbank Two');
    }

    get dismissOverlay() {
        return this.getElement('~Dismiss');
    }

    get getStartedButton() {
        return this.getElement({
            ios: '~Get started',
            android: "//android.widget.Button[@text='Get started' or contains(@content-desc, 'Get started')]"
        });
    }

    get usernameInput() {
        return this.getElement({
            ios: "//XCUIElementTypeTextField[@value='Username']",
            android: "//android.widget.EditText[@hint='Username']"
        });
    }

    get passwordInput() {
        return this.getElement({
            ios: "//XCUIElementTypeSecureTextField[@name='Password']", 
            android: "//android.widget.EditText[@hint='Password' and @password='true']"
        });
    }

    get secureSignInButton() {
        return this.getElement({
            ios: '~Secure Sign In',
            android: "//android.widget.Button[@text='Secure Sign In']"
        });
    }

    get connectionSuccessfulLabel() {
        return this.getElement({
            ios: '~Connection successful',
            android: "//*[contains(@text, 'Connection successful')]"
        });
    }

    get closeButton() {
        return this.getElement({
            ios: '~Close',
            android: "//android.widget.Button[@text='Close']"
        });
    }

    get bankAccountGroup() {
        return this.getElement({
            ios: '~Bank',
            android: "//android.widget.ImageView[contains(@content-desc, 'Bank')]"
        });
    }

    get leanMockbankAccount() {
        return this.getElement(getDynamicSelector('Lean Mockbank Two'));
    }

    async tapSelectBank() {
        await this.selectBankButton.click();
    }

    async skipBankLinking() {
        await step('Skip bank account linking', async () => {
            const maybeLaterBtn = await this.maybeLaterButton;
            await waitForSystemModalToDismiss();
            const isDisplayed = await waitForDisplayed(maybeLaterBtn);
            
            if (isDisplayed) {
                await maybeLaterBtn.click();
                
                const continueSkipBtn = await this.continueToSkipButton;
                const skipDisplayed = await waitForDisplayed(continueSkipBtn);
                
                if (skipDisplayed) {
                    await continueSkipBtn.click();
                }
            }
        });
    }

    async linkBankAccount(bankUsername: string, bankPassword: string) {
        await step('Link bank account via Lean Mockbank Two', async () => {
            await this.tapLinkYourAccounts();
            await this.selectUAEBanks();
            await this.selectLinkYourAccount();
            await this.selectLeanMockbankTwo();
            await this.tapGetStarted();
            await this.enterBankCredentials(bankUsername, bankPassword);
            await this.tapSecureSignIn();
            await this.verifyConnectionSuccessful();
            await this.closeConnection();
        });
    }

    async tapLinkYourAccounts() {
        const button = await this.linkYourAccountsButton;
        await verifyElementDisplayed(button);
        await button.click();
    }

    async selectUAEBanks() {
        const option = await this.uaeBanksOption;
        await verifyElementDisplayed(option);
        await option.click();
    }

    async selectLinkYourAccount() {
        const button = await this.linkAccountModalButton;
        await verifyElementDisplayed(button);
        await button.click();
    }

    async selectLeanMockbankTwo() {
        const option = await this.leanMockbankTwo;
        await verifyElementDisplayed(option);
        await option.click();
        
        await smartWait(TIMEOUTS.LEAN_SDK_LOADING);
    }

    async tapGetStarted() {
        await safeOperation(async () => {
            const overlay = await this.dismissOverlay;
            const isOverlayVisible = await waitForDisplayed(overlay, 3000);
            if (isOverlayVisible) {
                console.log('🚫 Dismissing Lean SDK overlay...');
                await overlay.click();
            }
        });
        
        const button = await this.getStartedButton;
        await verifyElementDisplayed(button);
        await button.click();
    }

    async enterBankCredentials(username: string, password: string) {
        const usernameField = await this.usernameInput;
        await verifyElementDisplayed(usernameField);
        await usernameField.click();
        await usernameField.setValue(username);

        const passwordField = await this.passwordInput;
        await verifyElementDisplayed(passwordField);
        await passwordField.click();
        await passwordField.setValue(password);

    }

    async tapSecureSignIn() {
        const button = await this.secureSignInButton;
        await verifyElementDisplayed(button);
        await button.click();
    }

    async verifyConnectionSuccessful() {
        const successLabel = await this.connectionSuccessfulLabel;
        await verifyElementDisplayed(successLabel);
        await expect(successLabel).toBeDisplayed();
    }

    async closeConnection() {
        await safeOperation(async () => {
            const overlay = await this.dismissOverlay;
            const isOverlayVisible = await waitForDisplayed(overlay, 3000);
            if (isOverlayVisible) {
                console.log('🚫 Dismissing connection success overlay...');
                await overlay.click();
            }
        });
        
        const button = await this.closeButton;
        await verifyElementDisplayed(button);
        await button.click();
    }

    async verifyBankAccountLinked() {
        const bankGroup = await this.bankAccountGroup;
        await verifyElementDisplayed(bankGroup);
        await expect(bankGroup).toBeDisplayed();
        
        console.log('🏦 Expanding Bank section to verify connection...');
        await bankGroup.click();
        
        const leanAccount = await this.leanMockbankAccount;
        await smartWait(
            async () => {
                const exists = await leanAccount.isExisting().catch(() => false);
                const displayed = exists ? await leanAccount.isDisplayed().catch(() => false) : false;
                return displayed;
            },
            {
                timeout: TIMEOUTS.STANDARD,
                interval: TIMEOUTS.POLLING_INTERVAL,
                message: 'Bank account details not displayed after expanding section'
            }
        );
        
        await verifyElementDisplayed(leanAccount);
        await expect(leanAccount).toBeDisplayed();
        
        const accountDesc = await leanAccount.getAttribute('content-desc');
        expect(accountDesc).toContain('Lean Mockbank Two Bank');
        
        console.log('✅ Bank account successfully linked and verified!');
    }

}

export default new LinkBank();