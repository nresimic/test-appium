import BaseScreen from './base.screen';
import { scrollToElementMobile } from '../utils/gesture.utils';

class DashboardScreen extends BaseScreen {
    
    get netWorthLabel() {
        return this.getElement('//*[contains(@content-desc, "Net worth")]');
    }

    get startBuildingPortfolioLabel() {
        return this.getElement('~Start building your portfolio');
    }
    
    get netWorthAmount() {
        return this.netWorthLabel;
    }
    
    get financialFitnessLabel() {
        return this.getElement('//*[@text="Financial fitness level" or contains(@content-desc, "Financial fitness")]');
    }
    
    get financialFitnessScore() {
        return this.getElement('//*[@text="0"]');
    }
    
    get financialFitnessMax() {
        return this.getElement('//*[@text="/1000"]');
    }
    
    get viewAllOffersButton() {
        return this.getElement('~View all offers');
    }
    
    get editWidgetsButton() {
        return this.getElement('~Edit widgets');
    }

    async verifyStartBuildingPortfolioLabel() {
        await this.startBuildingPortfolioLabel.waitForDisplayed();
        await expect(this.startBuildingPortfolioLabel).toBeDisplayed();
    }
    
    async validateNetWorthSection(expectedAmount: string = 'AED0') {
        const netWorthElement = await this.netWorthLabel;
        await expect(netWorthElement).toBeDisplayed();
        
        if (expectedAmount) {
            const contentDesc = await netWorthElement.getAttribute('content-desc');
            console.log('Net worth content-desc:', contentDesc);
            expect(contentDesc).toContain('Net worth');
            expect(contentDesc).toContain(expectedAmount);
        }
    }
    
    async validateFinancialFitnessSection(expectedScore: string = '0', expectedMax: string = '/1000') {
        await expect(this.financialFitnessLabel).toBeDisplayed();
        await expect(this.financialFitnessScore).toBeDisplayed();
        await expect(this.financialFitnessMax).toBeDisplayed();
        
        const score = await this.financialFitnessScore.getText();
        const max = await this.financialFitnessMax.getText();
        
        expect(score).toBe(expectedScore);
        expect(max).toBe(expectedMax);
    }
    
    async validateDashboardButtons() {
        await scrollToElementMobile(this.viewAllOffersButton, 'View all offers');
        await expect(this.viewAllOffersButton).toBeDisplayed();
        await scrollToElementMobile(this.editWidgetsButton, 'Edit widgets');
        await expect(this.editWidgetsButton).toBeDisplayed();
    }
    
    async validateFullDashboard() {
        await this.validateNetWorthSection();
        await this.validateFinancialFitnessSection();
        await this.validateDashboardButtons();
    }
    
    async tapViewAllOffers() {
        await scrollToElementMobile(this.viewAllOffersButton, 'View all offers');
        await this.viewAllOffersButton.click();
    }
    
    async tapEditWidgets() {
        await scrollToElementMobile(this.editWidgetsButton, 'Edit widgets');
        await this.editWidgetsButton.click();
    }
}

export default new DashboardScreen();