import { verifyElementDisplayed, smartWait, TIMEOUTS } from '../../utils/wait.utils';
import { getDynamicSelector } from '../../utils/selector.utils';
import { hideKeyboard, withKeyboardHidden } from '../../utils/keyboard.utils';
import BaseScreen from '../base.screen';

class ProfileScreen extends BaseScreen {
    get profileSettingsHeader() {
        return this.getElement('~Profile settings');
    }

    get nickNameField() {
        return this.getElement(getDynamicSelector('Nickname'));
    }

    get nameField() {
        return this.getElement(getDynamicSelector('First name'));
    }

    get surnameField() {
        return this.getElement(getDynamicSelector('Surname'));
    }

    get genderField() {
        return this.getElement(getDynamicSelector('Gender'));
    }

    get dateOfBirthField() {
        return this.getElement(getDynamicSelector('Date of birth'));
    }

    get householdField() {
        return this.getElement(getDynamicSelector('Home'));
    }

    get locationField() {
        return this.getElement(getDynamicSelector('Address'));
    }

    get reason() {
        return this.getElement(getDynamicSelector("What's your reason"));
    }

    get editTextInput() {
        return this.getElement({
            android: 'android.widget.EditText',
            ios: 'XCUIElementTypeTextField'
        });
    }

    get updateButton() {
        return this.getElement('~Update');
    }

    get cancelButton() {
        return this.getElement('~Cancel');
    }

    // Gender option locators
    get maleOption() {
        return this.getElement('~Male');
    }

    get femaleOption() {
        return this.getElement('~Female');
    }

    get otherOption() {
        return this.getElement('~Other');
    }

    get preferNotToSayOption() {
        return this.getElement('~Prefer not to say');
    }

    async verifyProfileScreenDisplayed() {
        const header = await this.profileSettingsHeader;
        await verifyElementDisplayed(header);
    }


    async tapNickNameField() {
        const field = await this.nickNameField;
        await field.click();
    }

    async tapNameField() {
        const field = await this.nameField;
        await field.click();
    }

    async tapSurnameField() {
        const field = await this.surnameField;
        await field.click();
    }

    async updateFieldValue(newValue: string) {
        const input = await this.editTextInput;
        await input.clearValue();
        await input.setValue(newValue);
    }

    async clearAndTypeValue(newValue: string) {
        if (this.isAndroid) {
            const currentText = await this.editTextInput.getText();
            const backspaceCount = currentText.length;
            
            for (let i = 0; i < backspaceCount; i++) {
                await browser.keys(['Backspace']);
                await smartWait(TIMEOUTS.CHAR_INPUT_DELAY);
            }
        } else {
            await this.editTextInput.clearValue();
        }
        
        await smartWait(TIMEOUTS.FIELD_INTERACTION_DELAY);
        
        if (this.isAndroid) {
            await driver.execute('mobile: type', { text: newValue });
        } else {
            await this.editTextInput.setValue(newValue);
        }
        
        await hideKeyboard();
    }

    async tapUpdateButton() {
        await withKeyboardHidden(async () => {
            const button = await this.updateButton;
            await button.click();
        });
    }

    async tapCancelButton() {
        await withKeyboardHidden(async () => {
            const button = await this.cancelButton;
            await button.click();
        });
    }

    async tapGenderField() {
        const field = await this.genderField;
        await field.click();
    }

    async selectGenderOption(genderOption: 'Male' | 'Female' | 'Other' | 'Prefer not to say') {
        let option;
        switch (genderOption) {
            case 'Male':
                option = await this.maleOption;
                break;
            case 'Female':
                option = await this.femaleOption;
                break;
            case 'Other':
                option = await this.otherOption;
                break;
            case 'Prefer not to say':
                option = await this.preferNotToSayOption;
                break;
        }
        
        await option.waitForDisplayed({ timeout: 5000 });
        await option.click();
        await smartWait(TIMEOUTS.ANIMATION);
    }

    async verifyGenderModalDisplayed() {
        await verifyElementDisplayed(await this.maleOption);
        await verifyElementDisplayed(await this.femaleOption);
        await verifyElementDisplayed(await this.otherOption);
        await verifyElementDisplayed(await this.preferNotToSayOption);
        await verifyElementDisplayed(await this.updateButton);
        await verifyElementDisplayed(await this.cancelButton);
    }

    async verifyGenderOptionSelected(genderOption: 'Male' | 'Female' | 'Other' | 'Prefer not to say') {
        let option;
        switch (genderOption) {
            case 'Male':
                option = await this.maleOption;
                break;
            case 'Female':
                option = await this.femaleOption;
                break;
            case 'Other':
                option = await this.otherOption;
                break;
            case 'Prefer not to say':
                option = await this.preferNotToSayOption;
                break;
        }
        
        await verifyElementDisplayed(option);
    }

    async verifyGenderValue(expectedGender: string) {
        await smartWait(
            async () => {
                const genderField = await this.genderField;
                const accessibilityId = await genderField.getAttribute('content-desc');
                return accessibilityId && accessibilityId.includes(expectedGender);
            },
            {
                timeout: TIMEOUTS.STANDARD,
                message: `Gender did not update to "${expectedGender}" within timeout`,
                interval: TIMEOUTS.POLLING_INTERVAL
            }
        );
    }

    async verifyNicknameValue(expectedValue: string) {
        await smartWait(
            async () => {
                const nicknameField = await this.nickNameField;
                const accessibilityId = await nicknameField.getAttribute('content-desc');
                return accessibilityId && accessibilityId.includes(expectedValue);
            },
            {
                timeout: TIMEOUTS.STANDARD,
                message: `Nickname did not update to "${expectedValue}" within timeout`,
                interval: TIMEOUTS.POLLING_INTERVAL
            }
        );
    }


    async verifyGeneralSectionFields() {
        await verifyElementDisplayed(await this.nickNameField);
    }

    async verifyPersonalSectionFields() {
        await verifyElementDisplayed(await this.nameField);
        await verifyElementDisplayed(await this.surnameField);
        await verifyElementDisplayed(await this.genderField);
        await verifyElementDisplayed(await this.dateOfBirthField);
        await verifyElementDisplayed(await this.householdField);
        await verifyElementDisplayed(await this.locationField);
    }
}

export default new ProfileScreen();