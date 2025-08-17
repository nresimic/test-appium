/**
 * Supported currencies in Vault22 app
 * System supports minimum 15 major currencies
 */

export interface Currency {
    code: string;
    name: string;
    symbol: string;
    country: string;
}

export const SupportedCurrencies: Currency[] = [
    {
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
        country: 'United States'
    },
    {
        code: 'AED',
        name: 'United Arab Emirates Dirham',
        symbol: 'AED',
        country: 'United Arab Emirates'
    },
    {
        code: 'GBP',
        name: 'Great Britain Pound',
        symbol: '£',
        country: 'United Kingdom'
    },
    {
        code: 'EUR',
        name: 'Euro',
        symbol: '€',
        country: 'European Union'
    },
    {
        code: 'CNY',
        name: 'Chinese Yuan',
        symbol: '¥',
        country: 'China'
    },
    {
        code: 'INR',
        name: 'Indian Rupee',
        symbol: '₹',
        country: 'India'
    },
    {
        code: 'SAR',
        name: 'Saudi Arabian Riyal',
        symbol: 'SAR',
        country: 'Saudi Arabia'
    },
    {
        code: 'ZAR',
        name: 'South African Rand',
        symbol: 'R',
        country: 'South Africa'
    },
    {
        code: 'CHF',
        name: 'Swiss Franc',
        symbol: 'CHF',
        country: 'Switzerland'
    },
    {
        code: 'CAD',
        name: 'Canadian Dollar',
        symbol: 'C$',
        country: 'Canada'
    },
    {
        code: 'SGD',
        name: 'Singapore Dollar',
        symbol: 'S$',
        country: 'Singapore'
    },
    {
        code: 'JPY',
        name: 'Japanese Yen',
        symbol: '¥',
        country: 'Japan'
    },
    {
        code: 'QAR',
        name: 'Qatari Riyal',
        symbol: 'QAR',
        country: 'Qatar'
    },
    {
        code: 'AUD',
        name: 'Australian Dollar',
        symbol: 'A$',
        country: 'Australia'
    },
    {
        code: 'PKR',
        name: 'Pakistani Rupee',
        symbol: '₨',
        country: 'Pakistan'
    }
];

/**
 * Default currency for UAE users
 */
export const DEFAULT_CURRENCY = 'AED';

/**
 * Get currency by code
 */
export function getCurrencyByCode(code: string): Currency | undefined {
    return SupportedCurrencies.find(currency => currency.code === code);
}

/**
 * Get all currency codes
 */
export function getAllCurrencyCodes(): string[] {
    return SupportedCurrencies.map(currency => currency.code);
}

/**
 * Get currency symbol by code
 */
export function getCurrencySymbol(code: string): string {
    const currency = getCurrencyByCode(code);
    return currency ? currency.symbol : code;
}

/**
 * Find an unselected currency for testing
 * Searches through available currencies and returns first unselected one
 */
export async function findUnselectedCurrency(currencyScreen: any, excludeCurrencies: string[] = []): Promise<string | null> {
    const allCurrencies = getAllCurrencyCodes();
    const availableCurrencies = allCurrencies.filter(code => !excludeCurrencies.includes(code));
    
    for (const currencyCode of availableCurrencies) {
        try {
            await currencyScreen.searchCurrency(currencyCode);
            
            const element = await currencyScreen.getCurrencyElement(currencyCode);
            const exists = await element.isExisting();
            
            if (exists) {
                const isSelected = await currencyScreen.isCurrencySelected(currencyCode);
                if (!isSelected) {
                    console.log(`🎯 Found unselected currency: ${currencyCode}`);
                    return currencyCode;
                }
            }
            
            const searchInput = await currencyScreen.searchInput;
            await searchInput.clearValue();
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.log(`⚠️ Error checking currency ${currencyCode}`);
            continue;
        }
    }
    
    console.log(`❌ No unselected currency found. Excluded: ${excludeCurrencies.join(', ')}`);
    return null;
}

/**
 * Find two different unselected currencies for testing
 * Returns array with [cancelCurrency, persistCurrency] or empty array if not enough found
 */
export async function findTwoUnselectedCurrencies(currencyScreen: any): Promise<string[]> {
    const firstCurrency = await findUnselectedCurrency(currencyScreen);
    if (!firstCurrency) {
        return [];
    }
    
    const secondCurrency = await findUnselectedCurrency(currencyScreen, [firstCurrency]);
    if (!secondCurrency) {
        return [firstCurrency];
    }
    
    console.log(`✅ Found two unselected currencies: ${firstCurrency}, ${secondCurrency}`);
    return [firstCurrency, secondCurrency];
}

/**
 * Validate all currencies exist in the app
 * Returns array of missing currencies
 */
export async function validateAllCurrenciesExist(currencyScreen: any): Promise<string[]> {
    const allCurrencies = getAllCurrencyCodes();
    const missingCurrencies: string[] = [];
    
    console.log(`🔍 Validating ${allCurrencies.length} currencies exist in app...`);
    
    for (const currencyCode of allCurrencies) {
        try {
            await currencyScreen.searchCurrency(currencyCode);
            
            const element = await currencyScreen.getCurrencyElement(currencyCode);
            const exists = await element.isExisting();
            
            if (!exists) {
                missingCurrencies.push(currencyCode);
                console.log(`❌ Currency not found: ${currencyCode}`);
            } else {
                console.log(`✅ Currency found: ${currencyCode}`);
            }
            
            const searchInput = await currencyScreen.searchInput;
            await searchInput.clearValue();
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.log(`⚠️ Error validating currency ${currencyCode}`);
            missingCurrencies.push(currencyCode);
        }
    }
    
    if (missingCurrencies.length === 0) {
        console.log(`✅ All ${allCurrencies.length} currencies validated successfully`);
    } else {
        console.log(`❌ Missing currencies: ${missingCurrencies.join(', ')}`);
    }
    
    return missingCurrencies;
}

/**
 * Get a safe fallback currency that should always be available
 * Returns AED (default) if not excluded, otherwise first available
 */
export function getFallbackCurrency(excludeCurrencies: string[] = []): string {
    if (!excludeCurrencies.includes(DEFAULT_CURRENCY)) {
        return DEFAULT_CURRENCY;
    }
    
    const available = getAllCurrencyCodes().filter(code => !excludeCurrencies.includes(code));
    return available[0] || 'USD';
}