import { step, addAttachment } from '@wdio/allure-reporter';
import { BottomNavigationScreen, MenuScreen, SettingsScreen, ProfileScreen, AuthScreen } from '../../screens';
import { TestUsers } from '../../data';
import { SmartTestIsolation, TestIsolationLevel } from '../../utils';
import { verifyElementDisplayed } from '../../utils/wait.utils';
import { scrollToElement } from '../../utils/gesture.utils';

describe('Profile Settings', () => {
    const TEST_USER = TestUsers.validUserWithoutBankAcc;
    const NEW_NICKNAME = 'Nenad';
    
    beforeEach(async () => {
        await SmartTestIsolation.prepareForTest(
            TestIsolationLevel.PRESERVE_LOGIN,
            TEST_USER
        );
    });

    it('Should display all profile fields', async () => {   
        await step('Navigate to profile settings', async () => {
            await BottomNavigationScreen.tapMenuButton();
            await MenuScreen.tapSettingsButton();
            await SettingsScreen.openProfile();
            await AuthScreen.enterPasscode('0000');
            await ProfileScreen.verifyProfileScreenDisplayed();
        });
        
        await step('Verify general profile section fields', async () => {
            await ProfileScreen.verifyGeneralSectionFields();
            
            const screenshot = await browser.takeScreenshot();
            await addAttachment('General profile fields displayed', Buffer.from(screenshot, 'base64'), 'image/png');
        });
        
        await step('Verify personal section fields', async () => {
            await scrollToElement('~Personal');
            await ProfileScreen.verifyPersonalSectionFields();
            
            const screenshot = await browser.takeScreenshot();
            await addAttachment('Personal profile fields displayed', Buffer.from(screenshot, 'base64'), 'image/png');
        });
    });

    it('Should successfully change nickname', async () => {
        await step('Navigate to Dashboard and access Menu', async () => {
            await verifyElementDisplayed(await BottomNavigationScreen.dashboardButton);
            await BottomNavigationScreen.tapMenuButton();
        });

        await step('Open Settings from Menu', async () => {
            await MenuScreen.verifyMenuScreen();
            await MenuScreen.tapSettingsButton();
        });

        await step('Access Profile settings with security verification', async () => {
            await SettingsScreen.openProfile();
            await AuthScreen.enterPasscode(TEST_USER.passcode);
            await ProfileScreen.verifyProfileScreenDisplayed();
        });

        await step('Open nickname edit modal', async () => {
            await ProfileScreen.tapNickNameField();
            
            const screenshot = await browser.takeScreenshot();
            await addAttachment('Nickname edit modal opened', Buffer.from(screenshot, 'base64'), 'image/png');
        });

        await step('Clear existing nickname and enter new value', async () => {
            await ProfileScreen.clearAndTypeValue(NEW_NICKNAME);
        });

        await step('Save the nickname changes', async () => {
            await ProfileScreen.tapUpdateButton();
        });

        await step('Verify nickname was successfully updated', async () => {
            await ProfileScreen.verifyNicknameValue(NEW_NICKNAME);
            
            const screenshot = await browser.takeScreenshot();
            await addAttachment('Nickname successfully updated', Buffer.from(screenshot, 'base64'), 'image/png');
        });
    });

    it('Should allow canceling nickname changes', async () => {
        await step('Navigate to Profile settings through Menu', async () => {
            await BottomNavigationScreen.tapMenuButton();
            await MenuScreen.tapSettingsButton();
            await SettingsScreen.openProfile();
            await AuthScreen.enterPasscode(TEST_USER.passcode);
            await ProfileScreen.verifyProfileScreenDisplayed();
        });

        await step('Open nickname edit modal and cancel changes', async () => {
            await ProfileScreen.tapNickNameField();
            await ProfileScreen.clearAndTypeValue('TempNickname');
            await ProfileScreen.tapCancelButton();
        });

        await step('Verify nickname was not changed after cancel', async () => {
            await ProfileScreen.verifyProfileScreenDisplayed();
            
            const screenshot = await browser.takeScreenshot();
            await addAttachment('Nickname unchanged after cancel', Buffer.from(screenshot, 'base64'), 'image/png');
        });
    });

    it.only('Should successfully change gender selection', async () => {
        await step('Navigate to Profile settings through Menu', async () => {
            await BottomNavigationScreen.tapMenuButton();
            await MenuScreen.tapSettingsButton();
            await SettingsScreen.openProfile();
            await AuthScreen.enterPasscode(TEST_USER.passcode);
            await ProfileScreen.verifyProfileScreenDisplayed();
        });

        await step('Navigate to personal section and open gender modal', async () => {
            await scrollToElement('~Personal');
            await ProfileScreen.tapGenderField();
            await ProfileScreen.verifyGenderModalDisplayed();
            
            const screenshot = await browser.takeScreenshot();
            await addAttachment('Gender selection modal opened', Buffer.from(screenshot, 'base64'), 'image/png');
        });

        await step('Select "Male" gender option', async () => {
            await ProfileScreen.selectGenderOption('Male');
            
            // Verify the selection visually (Flutter limitations with checked state)
            await ProfileScreen.verifyGenderOptionSelected('Male');
            
            const screenshot = await browser.takeScreenshot();
            await addAttachment('After selecting Male option', Buffer.from(screenshot, 'base64'), 'image/png');
        });

        await step('Save gender selection', async () => {
            await ProfileScreen.tapUpdateButton();
        });

        await step('Verify gender was successfully updated', async () => {
            await ProfileScreen.verifyGenderValue('Male');
            
            const screenshot = await browser.takeScreenshot();
            await addAttachment('Gender successfully updated to Male', Buffer.from(screenshot, 'base64'), 'image/png');
        });
    });

    it('Should allow canceling gender selection changes', async () => {
        await step('Navigate to Profile settings through Menu', async () => {
            await BottomNavigationScreen.tapMenuButton();
            await MenuScreen.tapSettingsButton();
            await SettingsScreen.openProfile();
            await AuthScreen.enterPasscode(TEST_USER.passcode);
            await ProfileScreen.verifyProfileScreenDisplayed();
        });

        await step('Open gender modal and select different option without saving', async () => {
            await scrollToElement('~Personal');
            await ProfileScreen.tapGenderField();
            await ProfileScreen.verifyGenderModalDisplayed();
            await ProfileScreen.selectGenderOption('Female');
            await ProfileScreen.tapCancelButton();
        });

        await step('Verify profile screen is displayed after canceling', async () => {
            await ProfileScreen.verifyProfileScreenDisplayed();
            
            const screenshot = await browser.takeScreenshot();
            await addAttachment('Gender selection canceled successfully', Buffer.from(screenshot, 'base64'), 'image/png');
        });
    });

    it('Should test all gender options selection', async () => {
        const genderOptions: Array<'Male' | 'Female' | 'Other' | 'Prefer not to say'> = ['Male', 'Female', 'Other', 'Prefer not to say'];
        
        await step('Navigate to Profile settings', async () => {
            await BottomNavigationScreen.tapMenuButton();
            await MenuScreen.tapSettingsButton();
            await SettingsScreen.openProfile();
            await AuthScreen.enterPasscode(TEST_USER.passcode);
            await ProfileScreen.verifyProfileScreenDisplayed();
            await scrollToElement('~Personal');
        });

        for (const genderOption of genderOptions) {
            await step(`Test selecting "${genderOption}" gender option`, async () => {
                await ProfileScreen.tapGenderField();
                await ProfileScreen.verifyGenderModalDisplayed();
                await ProfileScreen.selectGenderOption(genderOption);
                await ProfileScreen.tapUpdateButton();
                await ProfileScreen.verifyGenderValue(genderOption);
                
                const screenshot = await browser.takeScreenshot();
                await addAttachment(`Gender set to ${genderOption}`, Buffer.from(screenshot, 'base64'), 'image/png');
            });
        }
    });

});