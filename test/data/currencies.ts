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