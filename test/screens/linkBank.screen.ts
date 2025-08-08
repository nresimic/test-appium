import BaseScreen from './base.screen';
import {  
    waitForDisplayed,
    waitForSystemModalToDismiss 
} from '../utils/wait.utils';
import { step } from '@wdio/allure-reporter';

class LinkBank extends BaseScreen {
    get linkBankAccount() {
        return this.getElement('~Select your bank');
    }

    get maybeLaterButton() {
        return this.getElement('~Maybe later');
    }

    get continueToSkipButton() {
        return this.getElement('~Continue to skip');
    }

    async tapLinkBankAccount() {
        await this.linkBankAccount.click();
    }

    async skipBankLinking() {
        await step('Skip bank account linking', async () => {
            const maybeLaterBtn = await this.maybeLaterButton;
            await waitForSystemModalToDismiss();
            const isDisplayed = await waitForDisplayed(maybeLaterBtn);
            
            if (isDisplayed) {
                await maybeLaterBtn.click();
                
                const continueSkipBtn = await this.continueToSkipButton;
                const skipDisplayed = await waitForDisplayed(continueSkipBtn);
                
                if (skipDisplayed) {
                    await continueSkipBtn.click();
                }
            }
        });
    }

}

export default new LinkBank();