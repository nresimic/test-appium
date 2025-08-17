export class TestError extends Error {
    constructor(
        message: string,
        public readonly context?: Record<string, unknown>,
        public readonly recoverable: boolean = false
    ) {
        super(message);
        this.name = 'TestError';
    }
}

export class ElementNotFoundError extends TestError {
    constructor(selector: string, timeout?: number) {
        const message = timeout 
            ? `Element not found: ${selector} after ${timeout}ms`
            : `Element not found: ${selector}`;
        super(message, { selector, timeout }, false);
        this.name = 'ElementNotFoundError';
    }
}

export class TimeoutError extends TestError {
    constructor(operation: string, timeout: number) {
        super(`Operation timed out: ${operation} after ${timeout}ms`, { operation, timeout }, true);
        this.name = 'TimeoutError';
    }
}

export class ValidationError extends TestError {
    constructor(expected: unknown, actual: unknown, field?: string) {
        const fieldStr = field ? ` for ${field}` : '';
        super(`Validation failed${fieldStr}. Expected: ${expected}, Got: ${actual}`, { expected, actual, field }, false);
        this.name = 'ValidationError';
    }
}

export async function withErrorHandling<T>(
    operation: () => Promise<T>,
    errorContext: {
        operation: string;
        recoverable?: boolean;
        onError?: (error: Error) => Promise<void>;
        fallback?: () => Promise<T>;
        maxRetries?: number;
        retryDelay?: number;
    }
): Promise<T> {
    const { 
        maxRetries = 1, 
        retryDelay = 1000
    } = errorContext;
    
    const actualRetries = maxRetries;
    const actualDelay = retryDelay;
    
    let lastError: TestError;
    
    for (let attempt = 1; attempt <= actualRetries; attempt++) {
        try {
            if (attempt > 1) {
                console.log(`🔄 Retry ${attempt}/${actualRetries} for: ${errorContext.operation}`);
                await new Promise(resolve => setTimeout(resolve, actualDelay * attempt));
            }
            
            return await operation();
        } catch (error) {
            lastError = error instanceof TestError 
                ? error 
                : new TestError(
                    `${errorContext.operation} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    { 
                        originalError: error, 
                        attempt, 
                        maxRetries: actualRetries
                    },
                    errorContext.recoverable ?? false
                );

            if (errorContext.onError) {
                await errorContext.onError(lastError);
            }
            
            if (attempt === actualRetries) {
                break;
            }
        }
    }

    if (errorContext.fallback && lastError!.recoverable) {
        console.log(`🔄 Attempting fallback for: ${errorContext.operation}`);
        return await errorContext.fallback();
    }

    throw lastError!;
}


export function logError(error: Error, context?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';
    console.error(`[${timestamp}] ❌ ${error.name}: ${error.message}${contextStr}`);
    
    if (error instanceof TestError && error.context) {
        console.error(`[${timestamp}] 📋 Error Context:`, error.context);
    }
}

export function isRecoverableError(error: Error): boolean {
    return error instanceof TestError && error.recoverable;
}

export async function safeOperation<T>(
    operation: () => Promise<T>,
    fallback?: T,
    options: {
        logAsWarning?: boolean;
        retryDelay?: number;
    } = {}
): Promise<T | undefined> {
    const { logAsWarning = true, retryDelay = 500 } = options;
    const maxAttempts = 1;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            if (attempt > 1) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
            return await operation();
        } catch (error) {
            if (attempt === maxAttempts) {
                if (logAsWarning) {
                    console.warn(`⚠️ Safe operation failed after ${attempt} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
                return fallback;
            }
        }
    }
    return fallback;
}

export async function withElementRetry<T>(
    elementGetter: () => WebdriverIO.Element,
    operation: (element: WebdriverIO.Element) => Promise<T>,
    options: {
        maxRetries?: number;
        retryDelay?: number;
        operationName?: string;
    } = {}
): Promise<T> {
    const { maxRetries = 3, retryDelay = 1000, operationName = 'Element operation' } = options;
    const actualRetries = maxRetries;
    
    let lastError: Error;
    
    for (let attempt = 1; attempt <= actualRetries; attempt++) {
        try {
            if (attempt > 1) {
                console.log(`🔄 Element retry ${attempt}/${actualRetries}: ${operationName}`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
            
            const element = elementGetter();
            await element.waitForExist({ timeout: 5000 });
            await element.waitForDisplayed({ timeout: 5000 });
            
            return await operation(element);
        } catch (error) {
            lastError = error as Error;
            
            if (attempt === actualRetries) {
                throw new TestError(
                    `${operationName} failed after ${actualRetries} attempts: ${lastError.message}`,
                    { attempts: actualRetries },
                    false
                );
            }
        }
    }
    
    throw lastError!;
}