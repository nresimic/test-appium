import BaseScreen from './base.screen';
import { verifyElementDisplayed } from '../utils/wait.utils';

class WelcomeScreen extends BaseScreen {
    get loginButton() {
        return this.getElement('~Login using Phone Number');
    }

    async tapLoginButton() {
        await this.loginButton.click();
    }

    async isScreenDisplayed() {
        const loginButton = this.loginButton;
        const exists = await this.isExisting(loginButton);
        if (!exists) return false;
        
        return await this.isDisplayed(loginButton);
    }
    
    async waitForScreen() {
        await verifyElementDisplayed(
            this.loginButton, 
            20000, 
            'Welcome screen did not appear after app launch'
        );
    }
}

export default new WelcomeScreen();