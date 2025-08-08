import BaseScreen from './base.screen';
import { 
    waitForDisplayed, 
    verifyElementDisplayed,
    waitForLoadingComplete,
    dismissKeyboard 
} from '../utils/wait.utils';
import { step, addAttachment } from '@wdio/allure-reporter';

class AuthScreen extends BaseScreen {
    get phoneInput() {
        if (this.isIOS) {
            return $('XCUIElementTypeTextField');
        }
        return $('android.widget.EditText');
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
        await step(`Enter phone number: ${phoneNumber}`, async () => {
            const input = await this.phoneInput;
            await input.click();
            await input.clearValue();
            
            if (this.isIOS) {
                for (const char of phoneNumber) {
                    await input.addValue(char);
                    await browser.pause(100);
                }
            } else {
                await input.setValue(phoneNumber);
            }
            
            const screenshot = await browser.takeScreenshot();
            await addAttachment('Phone number entered', Buffer.from(screenshot, 'base64'), 'image/png');
        });
    }

    async tapGetOtp() {
        await step('Tap Get OTP button', async () => {
            const getOtpBtn = await this.getOtpButton;
            await getOtpBtn.click();
            
            await waitForLoadingComplete(this.platform);
            
            const screenshot = await browser.takeScreenshot();
            await addAttachment('After Get OTP click', Buffer.from(screenshot, 'base64'), 'image/png');
        });
    }

    async enterOtp(otp: string) {
        await step(`Enter OTP: ${otp}`, async () => {
            await waitForLoadingComplete(this.platform);
            
            const otpField = await this.otpInput;
            await verifyElementDisplayed(this.resendOtpText);
            await otpField.click();
            await otpField.clearValue();
            await otpField.setValue(otp);
            
            const screenshot = await browser.takeScreenshot();
            await addAttachment('OTP entered', Buffer.from(screenshot, 'base64'), 'image/png');
        });
    }

    async enterPasscode(passcode: string) {
        await step(`Enter passcode: ${passcode}`, async () => {
            const passcodeField = await this.passcodeInput;
            await verifyElementDisplayed(passcodeField);
            
            await passcodeField.click();
            await passcodeField.clearValue();
            await passcodeField.setValue(passcode);
            
            console.log(`Entered passcode: ${passcode}`);
            
            const screenshot = await browser.takeScreenshot();
            await addAttachment('Passcode entered', Buffer.from(screenshot, 'base64'), 'image/png');
        });
    }

    async tapContinue() {
        await step('Tap Continue button', async () => {
            const continueBtn = await this.continueButton;
            await verifyElementDisplayed(continueBtn);
            await continueBtn.click();
        });
    }

    async enterProfileInfo(firstName: string, lastName: string, email: string) {
        await step('Enter profile information', async () => {
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
            
            // Dismiss keyboard after last name
            await dismissKeyboard();
            
            const emailField = await this.emailInput;
            await verifyElementDisplayed(emailField);
            await emailField.click();
            await emailField.clearValue();
            await emailField.setValue(email);
            
            // Dismiss keyboard after email
            await dismissKeyboard();
            
            const screenshot = await browser.takeScreenshot();
            await addAttachment('Profile info entered', Buffer.from(screenshot, 'base64'), 'image/png');
        });
    }

    async tapNext() {
        await step('Tap Next button', async () => {
            await this.nextButton.click();
        });
    }


    async verifyDashboard() {
        let isDisplayed = false;
        await step('Verify dashboard is displayed', async () => {
            const dashboard = await this.dashboardElement;
            isDisplayed = await waitForDisplayed(dashboard);
            
            const screenshot = await browser.takeScreenshot();
            await addAttachment('Dashboard displayed', Buffer.from(screenshot, 'base64'), 'image/png');
        });
        return isDisplayed;
    }

    async performLogin(user: { phoneNumber: string; otp: string; passcode: string }) {
        await this.enterPhoneNumber(user.phoneNumber);
        await this.tapGetOtp();
        await this.enterOtp(user.otp);

        await this.enterPasscode(user.passcode);
        await this.tapContinue();
        
        await waitForLoadingComplete(this.platform);

        await driver.pause(1000);
        const passcodeField = await this.passcodeInput;
        await waitForDisplayed(passcodeField);
        
        await this.enterPasscode(user.passcode);
        await this.tapContinue();
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