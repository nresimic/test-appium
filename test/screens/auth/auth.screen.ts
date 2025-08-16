import BaseScreen from '../base.screen';
import { 
    waitForDisplayed, 
    verifyElementDisplayed,
    waitForLoadingComplete,
    dismissKeyboard,
    waitForPasscodeScreen,
    waitAfterInput,
    waitAfterFieldInteraction,
    TIMEOUTS
} from '../../utils/wait.utils';

class AuthScreen extends BaseScreen {
    get phoneInput() {
        return this.getElement({
            android: 'android.widget.EditText',
            ios: 'XCUIElementTypeTextField'
        });
    }

    get getOtpButton() {
        return this.getElement('~Get OTP');
    }

    get otpInput() {
        return this.getElement({
            android: 'android.widget.EditText',
            ios: '~|'
        });
    }

    get resendOtpText() {
        return this.getElement('~Resend code');
    }

    get passcodeInput() {
        return this.getElement({
            android: 'android.widget.EditText',
            ios: '~|'
        });
    }

    get continueButton() {
        return this.getElement('~Continue');
    }

    get otpErrorMessage() {
        return this.getElement('~Internal error has occured. Please contact the Vault22 support team for assistance.');
    }

    get firstNameInput() {
        return this.getElement({
            android: 'android=new UiSelector().className("android.widget.EditText").instance(0)',
            ios: '~First Name'
        });
    }

    get lastNameInput() {
        return this.getElement({
            android: 'android=new UiSelector().className("android.widget.EditText").instance(2)',
            ios: '~Last Name'
        });
    }

    get emailInput() {
        return this.getElement({
            android: 'android=new UiSelector().className("android.widget.EditText").instance(3)',
            ios: '~Email'
        });
    }

    get nextButton() {
        return this.getElement('~Next');
    }

    get dashboardElement() {
        return this.getElement('~Dashboard');
    }

    async enterPhoneNumber(phoneNumber: string) {
        const input = await this.phoneInput;
        await input.click();
        await input.clearValue();
        
        if (this.isIOS) {
            for (const char of phoneNumber) {
                await input.addValue(char);
                await waitAfterInput('ios');
            }
        } else {
            await input.setValue(phoneNumber);
        }
    }

    async tapGetOtp() {
        const getOtpBtn = await this.getOtpButton;
        await getOtpBtn.click();
        await waitForLoadingComplete(this.platform);
    }

    async enterOtp(otp: string) {
        await waitForLoadingComplete(this.platform);
        
        const otpField = await this.otpInput;
        await verifyElementDisplayed(this.resendOtpText);
        await otpField.click();
        await otpField.clearValue();
        await otpField.setValue(otp);
    }

    async enterPasscode(passcode: string) {
        const passcodeField = await this.passcodeInput;
        await verifyElementDisplayed(passcodeField);
        
        await passcodeField.click();
        await passcodeField.clearValue();
        await passcodeField.setValue(passcode);
        
        // Passcode entered
    }

    async tapContinue() {
        const continueBtn = await this.continueButton;
        await verifyElementDisplayed(continueBtn);
        await continueBtn.click();
    }

    async enterProfileInfo(firstName: string, lastName: string, email: string) {
        const firstNameField = await this.firstNameInput;
        await verifyElementDisplayed(firstNameField);
        await firstNameField.click();
        await firstNameField.clearValue();
        await firstNameField.setValue(firstName);
        
        await dismissKeyboard();
        
        const lastNameField = await this.lastNameInput;
        await verifyElementDisplayed(lastNameField);
        await lastNameField.click();
        await lastNameField.clearValue();
        await lastNameField.setValue(lastName);
        
        await dismissKeyboard();
        
        const emailField = await this.emailInput;
        await verifyElementDisplayed(emailField);
        await emailField.click();
        await emailField.clearValue();
        await emailField.setValue(email);
        
        await dismissKeyboard();
    }

    async tapNext() {
        await this.nextButton.click();
    }


    async verifyDashboard() {
        const dashboard = await this.dashboardElement;
        return await waitForDisplayed(dashboard);
    }

    async verifyOtpError() {
        const errorElement = await this.otpErrorMessage;
        // Wait for the error element to be displayed with timeout
        await errorElement.waitForDisplayed({
            timeout: 5000,
            timeoutMsg: 'OTP error message did not appear'
        });
        return await errorElement.isDisplayed();
    }

    async performLogin(user: { phoneNumber: string; otp: string; passcode: string }) {
        const passcodeField = await this.passcodeInput;
        await this.enterPhoneNumber(user.phoneNumber);
        await this.tapGetOtp();
        await this.enterOtp(user.otp);

        await passcodeField.waitForDisplayed({ 
            timeout: 10000,
            timeoutMsg: 'Passcode field not displayed for confirmation'
        });
        await this.enterPasscode(user.passcode);
        await this.tapContinue();
        
        await waitForLoadingComplete(this.platform);
       
        await passcodeField.waitForDisplayed({ 
            timeout: 10000,
            timeoutMsg: 'Passcode field not displayed for confirmation'
        });
        
        await this.enterPasscode(user.passcode);
        await this.tapContinue();
    }

    async performPasscodeReauth(passcode: string): Promise<void> {
        console.log('🔐 Performing passcode re-authentication...');
        await this.enterPasscode(passcode);
        await waitForLoadingComplete(this.platform);
    }
    
    async performQuickLogin(user: { phoneNumber: string; otp: string; passcode: string }) {
        await this.enterCredentialsForQuickLogin(user);
        await waitForPasscodeScreen(TIMEOUTS.PASSCODE_SCREEN);
        await this.enterPasscodeForQuickLogin(user.passcode);
        await waitForLoadingComplete(this.platform);
    }

    private async enterCredentialsForQuickLogin(user: { phoneNumber: string; otp: string }) {
        await this.enterPhoneNumber(user.phoneNumber);
        await this.tapGetOtp();
        await this.enterOtp(user.otp);
    }

    private async enterPasscodeForQuickLogin(passcode: string) {
        const allEditTexts = await $$('android.widget.EditText');
        
        if (allEditTexts.length === 1) {
            await this.enterPasscodeInField(allEditTexts[0], passcode);
            return;
        }

        const passcodeField = await this.findPasswordField(allEditTexts);
        if (passcodeField) {
            await this.enterPasscodeInField(passcodeField, passcode);
            return;
        }

        if (allEditTexts.length > 0) {
            await this.enterPasscodeInField(allEditTexts[allEditTexts.length - 1], passcode);
        }
    }

    private async findPasswordField(editTexts: WebdriverIO.ElementArray): Promise<WebdriverIO.Element | null> {
        for (const field of editTexts) {
            try {
                const isPassword = await field.getAttribute('password');
                if (isPassword === 'true') {
                    return field;
                }
            } catch (e) {
                continue;
            }
        }
        return null;
    }

    private async enterPasscodeInField(field: WebdriverIO.Element, passcode: string) {
        await field.click();
        await waitAfterFieldInteraction();
        await field.clearValue();
        await field.setValue(passcode);
    }

    async performRegistration(user: { 
        phoneNumber: string; 
        otp: string; 
        passcode: string;
        firstName: string;
        lastName: string;
        email: string;
    }) {
        await this.enterPhoneNumber(user.phoneNumber);
        await this.tapGetOtp();
        await this.enterOtp(user.otp);
        
        await this.enterPasscode(user.passcode);
        await this.tapContinue();
        
        await this.enterPasscode(user.passcode);
        await this.tapContinue();
        
        await this.enterProfileInfo(user.firstName, user.lastName, user.email);
        await this.tapNext();
        
    }

}

export default new AuthScreen();