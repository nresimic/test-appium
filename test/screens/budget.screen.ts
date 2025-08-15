import BaseScreen from './base.screen';

class BudgetScreen extends BaseScreen {
    get createBudgetLabel() {
        return this.getElement('~Budget');
    }

    async verifyCreateBudgetLabel() {
        await this.createBudgetLabel.waitForDisplayed();
        await expect(this.createBudgetLabel).toBeDisplayed();
    }
}

export default new BudgetScreen();