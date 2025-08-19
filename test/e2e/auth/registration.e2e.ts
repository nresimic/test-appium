import { RegistrationFlow } from '../../flows';
import { BottomNavigationScreen, DashboardScreen, LinkBankScreen } from '../../screens';
import { TestUsers } from '../../data';
import { step } from '@wdio/allure-reporter';
import { 
    attachScreenshot,
    SmartTestIsolation,
    TestIsolationLevel 
} from '../../utils';

describe('Registration Flow', () => {
    beforeEach(async () => {
        await SmartTestIsolation.prepareForTest(TestIsolationLevel.FULL_CLEAN);
    });    
    
    it('Should register a new user successfully', async () => {
        const newUser = TestUsers.generateNewUser();
        
        await step('Register new user and skip bank linking', async () => {
            await RegistrationFlow.registerNewUserWithoutAddingBankAccount(newUser);
            
            await attachScreenshot('New user registered'); 
            
            await DashboardScreen.validateDashboardButtons();
        });
        
    });

    it.skip('Should register a new user and link bank account successfully', async () => {
        const newUser = TestUsers.generateNewUser();
        const bankUsername = process.env.bank_username || 'dorriskemmer';
        const bankPassword = process.env.bank_password || 'kAsPPxeFREd';
        
        await step('Register new user with complete bank linking flow', async () => {
            await RegistrationFlow.registerNewUserWithBankLinking(newUser, bankUsername, bankPassword);
            await attachScreenshot('User registered with bank linked');
        });

        await step('Verify bank account appears in portfolio', async () => {
            await BottomNavigationScreen.tapDashboardButton();
            await BottomNavigationScreen.tapBudgetButton();
            await BottomNavigationScreen.tapPortfolioButton();
            await LinkBankScreen.verifyBankAccountLinked();
            
            await attachScreenshot('Bank account linked in portfolio');
        });
        
    });
});