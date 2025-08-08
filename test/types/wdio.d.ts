/// <reference types="@wdio/types" />
/// <reference types="webdriverio/async" />

declare namespace WebdriverIO {
    interface Browser {
        getBundleId(): Promise<string>;
        getCurrentPackage(): Promise<string>;
        queryAppState(bundleId: string): Promise<number>;
        hideKeyboard(): Promise<void>;
    }
}

declare const driver: WebdriverIO.Browser;
declare const browser: WebdriverIO.Browser;
declare const $: typeof import('webdriverio').$;
declare const $$: typeof import('webdriverio').$$;
declare const expect: typeof import('expect-webdriverio').expect;