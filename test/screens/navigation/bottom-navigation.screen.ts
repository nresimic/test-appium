import BaseScreen from '../base.screen';

class BottomNavigationScreen extends BaseScreen {
    get dashboardButton() {
        return this.getElement('~Dashboard');
    }

    get portfolioButton() {
        return this.getElement('~Portfolio');
    }

    get transactionsButton() {
        return this.getElement('~Transactions');
    }

    get budgetButton() {
        return this.getElement('~Budget');
    }

    get menuButton() {
        return this.getElement({
            android: '//android.widget.ImageView[@content-desc="Menu"]',
            ios: '~Menu'
        });
    }

    async tapDashboardButton() {
        await this.dashboardButton.click();
    }
    
    async tapPortfolioButton() {
        await this.portfolioButton.click();
    }

    async tapTransactionsButton() {
        await this.transactionsButton.click();
    }
    
    async tapBudgetButton() {
        await this.budgetButton.click();
    }
    
    async tapMenuButton() {
        await this.menuButton.click();
    }
}

export default new BottomNavigationScreen();