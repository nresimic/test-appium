import { faker } from '@faker-js/faker';

export interface TestUser {
    phoneNumber: string;
    otp: string;
    passcode: string;
    firstName: string;
    lastName: string;
    email: string;
}

/**
 * Generate a valid UAE phone number for testing
 * UAE mobile numbers: 50/52/54/55/56/58 + 7 digits (total 9 digits)
 * Using 50XXXXXXX format
 */
function generateTestPhoneNumber(): string {
    const prefix = faker.helpers.arrayElement(['50', '52', '54', '55', '56', '58']);
    const middlePart = faker.number.int({ min: 100, max: 999 });
    const lastPart = faker.number.int({ min: 1000, max: 9999 });
    return `${prefix}${middlePart}${lastPart}`;
}

export const TestUsers = {
    // Existing user with linked bank account (fixed data)
    userWithBankAccount: {
        phoneNumber: '500990227',
        otp: '0000',
        passcode: '0000',
        firstName: 'Test',
        lastName: 'User',
        email: 'testonebewe.user@example.com'
    } as TestUser,
    
    // Existing user without bank account (fixed data)
    userWithoutBankAccount: {
        phoneNumber: '554595453',  // Different phone number
        otp: '0000',
        passcode: '0000',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe.test@example.com'
    } as TestUser,
    
    // Alias for backward compatibility
    get validUserWithBankAcc() {
        return this.userWithBankAccount;
    },
    
    // Getter for user without bank account
    get validUserWithoutBankAcc() {
        return this.userWithoutBankAccount;
    },
    
    // Generate new user for registration tests
    generateNewUser(): TestUser {
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();
        const uniqueId = Date.now();
        
        return {
            phoneNumber: generateTestPhoneNumber(),
            otp: '0000',
            passcode: '0000',
            firstName,
            lastName,
            email: faker.internet.email({ 
                firstName: firstName.toLowerCase(),
                lastName: `${lastName.toLowerCase()}.${uniqueId}`,
                provider: 'testapp.com'
            })
        };
    },
    
    // Get a new user instance (cached per test run)
    get newUser(): TestUser {
        if (!this._cachedNewUser) {
            this._cachedNewUser = this.generateNewUser();
        }
        return this._cachedNewUser;
    },
    
    // Private cached user
    _cachedNewUser: null as TestUser | null,
    
    // Invalid user for negative tests
    invalidUser: {
        phoneNumber: '000000000',
        otp: '9999',
        passcode: '1234',
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email()
    } as TestUser
};