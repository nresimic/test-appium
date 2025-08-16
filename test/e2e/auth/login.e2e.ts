import { LoginFlow } from '../../flows';
import { DashboardScreen, AuthScreen } from '../../screens';
import { TestUsers } from '../../data';
import { step } from '@wdio/allure-reporter';
import { 
    attachScreenshot,
    SmartTestIsolation,
    TestIsolationLevel 
} from '../../utils';
// No need to import tag utilities - just add @tags directly to test descriptions

describe('Login Flow', () => {
    beforeEach(async () => {
        // Auth tests need full clean state - no login preservation
        await SmartTestIsolation.prepareForTest(TestIsolationLevel.FULL_CLEAN);
    });
    
    it('Should login successfully with user having bank account @ios @android @auth @smoke', async () => {
        await step('Login with existing user', async () => {
            await LoginFlow.login(TestUsers.validUserWithBankAcc);            
        });
        
        await step('Verify dashboard elements for user with bank account', async () => {
            await DashboardScreen.validateDashboardButtons();
            await attachScreenshot('User logged in with bank account');
        });
    });

    it('Should login successfully with user without bank account', async () => {
        await step('Login with user without bank account', async () => {
            await LoginFlow.login(TestUsers.validUserWithoutBankAcc);
        });
        
        await step('Validate dashboard for user without bank account', async () => {
            await DashboardScreen.validateDashboardButtons();
            
            await attachScreenshot('User logged in without bank account');
        });
    });
    
    it('Should show error for invalid OTP', async () => {
        await step('Navigate to login screen', async () => {
            await LoginFlow.navigateToLoginScreen();
        });
        
        await step('Enter phone number and request OTP', async () => {
            await AuthScreen.enterPhoneNumber(TestUsers.validUserWithBankAcc.phoneNumber);
            await AuthScreen.tapGetOtp();
        });
        
        await step('Enter invalid OTP and verify error', async () => {
            await AuthScreen.enterOtp('9999');
            
            // Use WebdriverIO's expect with built-in waiting
            const errorElement = await AuthScreen.otpErrorMessage;
            await expect(errorElement).toBeDisplayed();
            
            await attachScreenshot('Error is displayed when wrong OTP is entered');
        });
    });
    
    it('Should require phone number for login', async () => {
        await step('Navigate to login screen', async () => {
            await LoginFlow.navigateToLoginScreen();
        });
        
        await step('Try to proceed without entering phone number', async () => {
            const getOtpButton = await AuthScreen.getOtpButton;
            
            await expect(getOtpButton).toBeDisabled();
            await attachScreenshot('Phone number is required to continue login flow');
        });
    });
});