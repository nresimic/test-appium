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
    }
): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        const testError = error instanceof TestError 
            ? error 
            : new TestError(
                `${errorContext.operation} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                { originalError: error },
                errorContext.recoverable ?? false
            );

        if (errorContext.onError) {
            await errorContext.onError(testError);
        }

        if (errorContext.fallback && testError.recoverable) {
            console.log(`🔄 Attempting fallback for: ${errorContext.operation}`);
            return await errorContext.fallback();
        }

        throw testError;
    }
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
    logAsWarning: boolean = true
): Promise<T | undefined> {
    try {
        return await operation();
    } catch (error) {
        if (logAsWarning) {
            console.warn(`⚠️ Safe operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        return fallback;
    }
}