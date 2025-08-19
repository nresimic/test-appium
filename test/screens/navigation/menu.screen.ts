import BaseScreen from '../base.screen';


class MenuScreen extends BaseScreen {

    get menuLabel() {
        return this.getElement({
            android: '//android.view.View[@content-desc="Menu"]',
            ios: '~Menu'
        });
    }

    get profileButton() {
        return this.getElement({
            android: '//*[contains(@content-desc, "Profile")]',
            ios: '-ios predicate string:name CONTAINS "Profile"'
        });
    }

    get notificationsButton() {
        return this.getElement('~Notifications');
    }

    get investmentsButton() {
        return this.getElement('~Investments');
    }

    get goalsButton() {
        return this.getElement('~Goals');
    }

    get settingsButton() {
        return this.getElement('~Settings');
    }

    get helpAndFaqButton() {
        return this.getElement('~Help & FAQ');
    }

    get termsOfServiceButton() {
        return this.getElement('~Terms of service');
    }

    get blogButton() {
        return this.getElement('~Blog');
    }

    get contactUsButton() {
        return this.getElement('~Contact us');
    }

    get voteForFeaturesButton() {
        return this.getElement('~Vote for features');
    }

    get signOutButton() {
        return this.getElement('~Sign out');
    }

    get copyCustomerIdButton() {
        return this.getElement('~Copy customer ID');
    }

    async verifyMenuScreen() {
        await this.menuLabel.waitForDisplayed();
        await this.profileButton.waitForDisplayed();
        await this.notificationsButton.waitForDisplayed();
        await this.investmentsButton.waitForDisplayed();
        await this.goalsButton.waitForDisplayed();
        await this.settingsButton.waitForDisplayed();
    }

    async tapProfileButton() {
        await this.profileButton.click();
    }

    async tapNotificationsButton() {
        await this.notificationsButton.click();
    }

    async tapInvestmentsButton() {
        await this.investmentsButton.click();
    }

    async tapGoalsButton() {
        await this.goalsButton.click();
    }

    async tapSettingsButton() {
        await this.settingsButton.click();
    }

    async tapHelpAndFaqButton() {
        await this.helpAndFaqButton.click();
    }

    async tapTermsOfServiceButton() {
        await this.termsOfServiceButton.click();
    }

    async tapBlogButton() {
        await this.blogButton.click();
    }

    async tapContactUsButton() {
        await this.contactUsButton.click();
    }

    async tapVoteForFeaturesButton() {
        await this.voteForFeaturesButton.click();
    }

    async tapSignOutButton() {
        await this.signOutButton.click();
    }

    async tapCopyCustomerIdButton() {
        await this.copyCustomerIdButton.click();
    }

    async performLogout() {
        
        await this.signOutButton.click();
    }
}

export default new MenuScreen();