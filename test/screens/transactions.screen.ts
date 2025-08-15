import BaseScreen from './base.screen';
import { waitForDisplayed } from '../utils/wait.utils';

class TransactionsScreen extends BaseScreen {
    get searchInput() {
        return this.getElement('~Search transactions, group, etc.');
    }

    get filterButton() {
        return this.getElement('~Filter');
    }

    get sortButton() {
        return this.getElement('~Sort');
    }

    get firstTransaction() {
        return this.getElement({
            android: '//android.view.ViewGroup[@content-desc="transaction-item"][1]',
            ios: '(//XCUIElementTypeOther[@name="transaction-item"])[1]'
        });
    }

    get noTransactionsText() {
        return this.getElement('~No transactions');
    }

    get transactionsList() {
        return this.getElement('~Transactions list');
    }

    async searchTransaction(searchText: string) {
        const search = await this.searchInput;
        await search.setValue(searchText);
    }

    async verifySearchTransaction() {
        const search = await this.searchInput;
        await waitForDisplayed(search);
        return await search.isDisplayed();
    }

    async tapFirstTransaction() {
        const transaction = await this.firstTransaction;
        await transaction.click();
    }

    async tapFilterButton() {
        const filter = await this.filterButton;
        await filter.click();
    }

    async tapSortButton() {
        const sort = await this.sortButton;
        await sort.click();
    }

    async getTransactionCount() {
        const transactions = await $$('[content-desc="transaction-item"]');
        return transactions.length;
    }

    async verifyNoTransactions() {
        const noTransactions = await this.noTransactionsText;
        return await noTransactions.isDisplayed();
    }

    async verifyTransactionsExist() {
        const list = await this.transactionsList;
        return await list.isExisting();
    }

    async getTransactionByDescription(description: string) {
        return this.getElement(`~${description}`);
    }

    async verifyTransactionExists(description: string) {
        try {
            const transaction = await this.getTransactionByDescription(description);
            return await transaction.isExisting();
        } catch (e) {
            return false;
        }
    }
}

export default new TransactionsScreen();