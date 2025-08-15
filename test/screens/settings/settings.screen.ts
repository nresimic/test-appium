import BaseScreen from '../base.screen';

class SettingsScreen extends BaseScreen {
    get profileButton() {
        return this.getElement('~Profile\nYour personal information');
    }

    get investmentStyleButton() {
        return this.getElement('~Investment Style\nSet investment experience and risk comfort');
    }

    get recurringPaymentsButton() {
        return this.getElement('~Recurring payments\nInstallments with active recurring payments');
    }

    get currencyButton() {
        return this.getElement('~Currency\nChoose preferred display currency');
    }

    get securityButton() {
        return this.getElement('~Security\nUpdate passcode and enable protection');
    }

    get notificationsButton() {
        return this.getElement('~Notifications\nManage alert preferences');
    }

    get languageButton() {
        return this.getElement('~Language\nChange app language');
    }

    get themeButton() {
        return this.getElement('~Theme\nSwitch between light and dark mode');
    }

    get accountPreferencesButton() {
        return this.getElement('~Account preferences\nAdjust your account settings');
    }

    get deactivatedAccountsButton() {
        return this.getElement('~Deactivated accounts\nSee all inactive accounts');
    }

    async openProfile() {
        await this.profileButton.click();
    }
    
    async openCurrency() {
        await this.currencyButton.click();
    }
    
    async openSecurity() {
        await this.securityButton.click();
    }
    
    async openLanguage() {
        await this.languageButton.click();
    }
    
    async openTheme() {
        await this.themeButton.click();
    }
    
    async openAccountPreferences() {
        await this.accountPreferencesButton.click();
    }
    
    async openDeactivatedAccounts() {
        await this.deactivatedAccountsButton.click();
    }
}

export default new SettingsScreen();