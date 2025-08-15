import BaseScreen from '../base.screen';
import { waitAfterFieldInteraction } from '../../utils/wait.utils';
import { getAllCurrencyCodes } from '../../data/currencies';

/**
 * Currency Settings screen
 * Handles currency selection and exchange rate display
 * Supports 15+ major currencies
 */
class CurrencyScreen extends BaseScreen {
    
    get searchInput() {
        // Search input uses hint text, not content-desc
        return this.getElement({
            android: 'android.widget.EditText',
            ios: 'XCUIElementTypeTextField'
        });
    }

    get currencyTitle() {
        return this.getElement('~Currency');
    }

    get confirmCurrencyButton() {
        return this.getElement('~Confirm Change');
    }

    get cancelButton() {
        return this.getElement('~Cancel');
    }
    
    get successMessage() {
        return this.getElement('~Currency changed successfully');
    }
    
    // Get currency element by code (e.g., "AED", "USD", "SAR")
    getCurrencyElement(currencyCode: string) {
        // The content-desc contains both code and name like "AED\nUnited Arab Emirates Dirham"
        // Using starts-with to match the currency code at the beginning
        if (this.isAndroid) {
            return this.getElement(`//*[starts-with(@content-desc, "${currencyCode}")]`);
        } else {
            return this.getElement(`//*[starts-with(@name, "${currencyCode}")]`);
        }
    }
    
    // Get full currency element with name (e.g., "AED\nUnited Arab Emirates Dirham")
    getFullCurrencyElement(currencyCode: string, currencyName: string) {
        return this.getElement(`~${currencyCode}\n${currencyName}`);
    }
    
    /**
     * Check if a currency is currently selected
     * Selected currencies are not clickable and use ImageView on Android
     */
    async isCurrencySelected(currencyCode: string): Promise<boolean> {
        const element = await this.getCurrencyElement(currencyCode);
        
        if (!await element.isExisting()) {
            return false;
        }
        
        if (this.isAndroid) {
            // On Android, selected currency has clickable='false' attribute and uses ImageView class
            const clickable = await element.getAttribute('clickable');
            const className = await element.getAttribute('class');
            return clickable === 'false' || className.includes('ImageView');
        } else {
            // On iOS, check the selected attribute
            const isSelected = await element.getAttribute('selected');
            return isSelected === 'true';
        }
    }
    
    /**
     * Search for a currency
     */
    async searchCurrency(searchText: string) {
        const search = await this.searchInput;
        await search.click();
        await search.clearValue();
        await search.setValue(searchText);
        
        // Wait for search results to filter
        await waitAfterFieldInteraction();
    }
    
    /**
     * Wait for currency element to be displayed
     */
    async waitForCurrencyElement(currencyCode: string, timeout: number = 5000) {
        const element = await this.getCurrencyElement(currencyCode);
        await element.waitForDisplayed({ timeout });
        return element;
    }
    
    /**
     * Select a currency from the list
     */
    async selectCurrency(currencyCode: string) {
        const element = await this.getCurrencyElement(currencyCode);
        
        // Wait for element to be clickable
        await element.waitForDisplayed({ timeout: 3000 });
        
        // Click to select
        await element.click();
        
        // Wait for selection to register
        await waitAfterFieldInteraction();
    }
    
    /**
     * Confirm currency change
     */
    async confirmCurrencyChange() {
        await this.confirmCurrencyButton.waitForDisplayed();
        await this.confirmCurrencyButton.click();
    }
    
    /**
     * Wait for and verify success message
     */
    async verifySuccessMessage() {
        await this.successMessage.waitForDisplayed({ timeout: 5000 });
        return await this.successMessage.isDisplayed();
    }
    
    /**
     * Cancel currency change
     */
    async cancelCurrencyChange() {
        await this.cancelButton.waitForDisplayed();
        await this.cancelButton.click();
    }
    
    /**
     * Get the currently selected currency code
     */
    async getCurrentSelectedCurrency(): Promise<string | null> {
        // Check all supported currencies from data file
        const currencies = getAllCurrencyCodes();
        
        for (const currency of currencies) {
            if (await this.isCurrencySelected(currency)) {
                return currency;
            }
        }
        
        return null;
    }
    
    /**
     * Verify currency screen is displayed
     */
    async verifyCurrencyScreen() {
        await this.currencyTitle.waitForDisplayed();
        return await this.searchInput.isDisplayed();
    }
}

export default new CurrencyScreen();