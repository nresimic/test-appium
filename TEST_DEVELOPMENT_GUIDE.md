# Test Development Guide for Vault22 Testing Framework

## ⚠️ IMPORTANT: This guide must be followed when developing new tests

This document contains the specific patterns, utilities, and approaches used in the Vault22 testing framework. Any new test development should follow these guidelines to maintain consistency.

---

## 1. Project Structure

```
vault22-testing/
├── test/
│   ├── e2e/              # Test files organized by feature
│   │   ├── auth/         # Authentication tests
│   │   ├── settings/     # Settings tests
│   │   └── ...
│   ├── screens/          # Page Object Model screens
│   │   ├── auth/
│   │   ├── settings/
│   │   └── base.screen.ts
│   ├── flows/            # Reusable user flows
│   ├── data/             # Test data
│   └── utils/            # Utility functions
```

---

## 2. Finding Locators in the App

### Step 1: Check the Flutter/React Native Implementation

1. **For Vault22-Global (Flutter app):**
   - Check `/NextGen/lib/presentation/` for the actual UI implementation
   - Look for `Text()`, `MenuItem()`, `TextFormField()` widgets
   - Flutter doesn't automatically add accessibility IDs, so text content becomes the locator

2. **Example: Finding Profile Button**
   ```dart
   // In NextGen/lib/presentation/settings/settings.dart
   MenuItem(
     text: "Profile",  // This becomes our locator text
     onTap: () { ... }
   )
   ```

### Step 2: Determine Locator Strategy

**Priority order for locators:**
1. Accessibility ID (if available): `~AccessibilityId`
2. Text content: `//*[@text="Profile"]` (Android) or `~Profile` (iOS)
3. Class-based with index: `android.widget.EditText` (for generic inputs)

---

## 3. Writing Screen Objects

### Location
All screen objects go in `/test/screens/[feature]/[screen-name].screen.ts`

### Pattern
```typescript
import BaseScreen from '../base.screen';
import { verifyElementDisplayed } from '../../utils/wait.utils';

class ProfileScreen extends BaseScreen {
    // 1. Define getters for elements
    get profileSettingsHeader() {
        return this.getElement('//*[contains(@text, "Profile settings")]');
    }
    
    // For platform-specific locators
    get editTextInput() {
        return this.getElement({
            android: 'android.widget.EditText',
            ios: 'XCUIElementTypeTextField'
        });
    }
    
    // 2. Define action methods
    async tapProfileField() {
        const field = await this.profileField;
        await field.click();
    }
    
    async updateFieldValue(newValue: string) {
        const input = await this.editTextInput;
        await input.clearValue();
        await input.setValue(newValue);
    }
    
    // 3. Define verification methods
    async verifyProfileScreenDisplayed() {
        const header = await this.profileSettingsHeader;
        await verifyElementDisplayed(header);
    }
}

export default new ProfileScreen();
```

---

## 4. Writing Test Files

### Location
Test files go in `/test/e2e/[feature]/[test-name].e2e.ts`

### Pattern
```typescript
import { step } from '@wdio/allure-reporter';
import { BottomNavigationScreen, MenuScreen, SettingsScreen } from '../../screens';
import { TestUsers } from '../../data';
import { SmartTestIsolation, TestIsolationLevel, attachScreenshot } from '../../utils';

describe('Feature Name', () => {
    const TEST_USER = TestUsers.validUserWithoutBankAcc;
    
    beforeEach(async () => {
        // Use SmartTestIsolation for setup
        await SmartTestIsolation.prepareForTest(
            TestIsolationLevel.PRESERVE_LOGIN,  // or FULL_CLEAN
            TEST_USER
        );
    });
    
    it('Should do something', async () => {
        await step('Navigate to screen', async () => {
            await BottomNavigationScreen.tapMenuButton();
            await MenuScreen.tapSettingsButton();
            await SettingsScreen.openProfile();
        });
        
        await step('Perform action', async () => {
            await ProfileScreen.tapNameField();
            await ProfileScreen.updateFieldValue('New Value');
            await ProfileScreen.tapSaveButton();
        });
        
        await step('Verify result', async () => {
            // Verification logic
            await attachScreenshot('Description of screenshot');
        });
    });
});
```

---

## 5. Available Test Isolation Levels

Use `SmartTestIsolation.prepareForTest()` with these levels:

- `TestIsolationLevel.FULL_CLEAN` - Complete reset, requires login
- `TestIsolationLevel.PRESERVE_LOGIN` - Keeps user logged in, lands on dashboard
- `TestIsolationLevel.PRESERVE_STATE` - Minimal reset, preserves app state

**After `PRESERVE_LOGIN`, you're on the dashboard - no need for additional login steps!**

---

## 6. Navigation Patterns

### Standard Navigation Flow
```typescript
// From Dashboard to Settings
await BottomNavigationScreen.tapMenuButton();
await MenuScreen.tapSettingsButton();

// From Settings to specific setting
await SettingsScreen.openProfile();
await SettingsScreen.openCurrency();
await SettingsScreen.openSecurity();
```

---

## 7. Available Utility Functions

### Wait Utilities (`/test/utils/wait.utils.ts`)
- `verifyElementDisplayed(element)` - Verify element is displayed
- `waitForDisplayed(element)` - Wait for element to be displayed
- `waitForLoadingComplete(platform)` - Wait for loading to complete
- `smartWait(condition, options)` - Smart waiting with custom condition

### Screenshot Utilities (`/test/utils/allure.utils.ts`)
- `attachScreenshot(description)` - Attach screenshot to Allure report

### Gesture Utilities (`/test/utils/gesture.utils.ts`)
- `scrollToElementWithDirection(selector, direction, maxScrolls)`
- `SwipeDirection.UP`, `SwipeDirection.DOWN`

### Platform Detection
- `BaseScreen.isAndroid` - Check if Android
- `BaseScreen.isIOS` - Check if iOS

---

## 8. Test Data

### Location
`/test/data/test-users.ts`

### Available Test Users
```typescript
TestUsers.validUserWithBankAcc     // User with linked bank account
TestUsers.validUserWithoutBankAcc  // User without bank account
TestUsers.generateNewUser()        // Generate new user for registration
```

---

## 9. Common Patterns

### Scrolling to Elements
```typescript
// Android
const scrollable = await $('android=new UiScrollable(new UiSelector().scrollable(true))');
await scrollable.scrollIntoView('new UiSelector().text("Personal")');

// iOS
await browser.execute('mobile: swipe', { direction: 'up' });
```

### Handling Platform Differences
```typescript
if (ProfileScreen.isAndroid) {
    // Android-specific code
} else {
    // iOS-specific code
}
```

### Pausing for UI Updates
```typescript
await browser.pause(2000);  // Use sparingly, prefer smart waits
```

---

## 10. DO's and DON'Ts

### DO's ✅
- Put ALL locators in screen objects
- Use methods in screen objects for actions
- Use `SmartTestIsolation` for test setup
- Follow the existing navigation patterns
- Use step() for test organization
- Attach screenshots at key points

### DON'Ts ❌
- Don't put locators directly in tests
- Don't use raw $ or $$ in test files
- Don't assume accessibility IDs exist - check the app code
- Don't add passcode entry after `PRESERVE_LOGIN` - you're already logged in
- Don't create new patterns - follow existing ones

---

## 11. Adding New Functionality

When adding new utilities or patterns:

1. **Update this guide** with the new functionality
2. **Follow existing patterns** in the codebase
3. **Add to appropriate location**:
   - New utilities → `/test/utils/`
   - New screens → `/test/screens/[feature]/`
   - New flows → `/test/flows/`
   - New test data → `/test/data/`

---

## 12. Debugging Tips

### Check Element Existence
```typescript
const element = await ProfileScreen.someElement;
const exists = await element.isExisting();
const displayed = await element.isDisplayed();
```

### Log Element Information
```typescript
console.log('Element text:', await element.getText());
console.log('Element displayed:', await element.isDisplayed());
```

### Finding Elements Without Accessibility IDs
When Flutter/React Native doesn't provide accessibility IDs:
1. Check the actual app code for text content
2. Use XPath with text content: `//*[@text="Profile"]` or `//*[contains(@text, "Profile")]`
3. For inputs without IDs, use class selectors: `android.widget.EditText`

---

## 13. Example: Complete Test Development Flow

### Step 1: Find the UI in App Code
```bash
# Search for the feature in NextGen
grep -r "Profile" /Users/n.resimic/Desktop/Projects/Nenad/vault22/NextGen/lib/presentation/
```

### Step 2: Create/Update Screen Object
```typescript
// In test/screens/settings/profile.screen.ts
class ProfileScreen extends BaseScreen {
    get nickNameField() {
        return this.getElement('//*[contains(@text, "Nick name")]');
    }
}
```

### Step 3: Write the Test
```typescript
// In test/e2e/settings/profile.e2e.ts
it('Should update nickname', async () => {
    await step('Navigate to profile', async () => {
        await BottomNavigationScreen.tapMenuButton();
        await MenuScreen.tapSettingsButton();
        await SettingsScreen.openProfile();
    });
    
    await step('Update nickname', async () => {
        await ProfileScreen.tapNickNameField();
        await ProfileScreen.updateFieldValue('NewNickname');
        await ProfileScreen.tapSaveButton();
    });
});
```

---

## 14. Running Tests

```bash
# Run specific test file
npm run test:android -- --spec="test/e2e/settings/profile.e2e.ts"

# Run with specific test
npm run test:android -- --spec="test/e2e/settings/profile.e2e.ts" --mochaOpts.grep="Should display all profile fields"
```

---

**Remember: When in doubt, look at existing tests like `currency.e2e.ts` or `login.e2e.ts` for patterns!**