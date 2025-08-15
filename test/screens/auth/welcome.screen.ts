import BaseScreen from '../base.screen';
import { verifyElementDisplayed } from '../../utils/wait.utils';

class WelcomeScreen extends BaseScreen {
    get loginButton() {
        return this.getElement('~Login using Phone Number');
    }

    async tapLoginButton() {
        await this.loginButton.click();
    }

    async isScreenDisplayed() {
        const loginButton = await this.loginButton;
        const exists = await loginButton.isExisting();
        if (!exists) return false;
        
        return await loginButton.isDisplayed();
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