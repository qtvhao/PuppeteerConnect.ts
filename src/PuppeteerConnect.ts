import puppeteer, { Browser } from 'puppeteer';
import { BrowserVersionResponse } from './definitions.d/BrowserVersionResponse';

const MAX_RETRIES: number = 3; // Maximum retry attempts
const BASE_WAIT_TIME: number = 2000; // Base wait time in milliseconds
const BROWSER_WS_ENDPOINT: string = process.env.BROWSER_WS_ENDPOINT || 'http://localhost:21222'; // Default endpoint

/**
 * Connects to a Puppeteer-controlled browser using `BROWSER_WS_ENDPOINT`, with retries.
 */
export class PuppeteerConnect {
    private static browserWsEndpoint: string = BROWSER_WS_ENDPOINT;

    public static setBrowserWebSocketEndpoint(endpoint: string): void {
        this.browserWsEndpoint = endpoint;
    }

    private static async getBrowserWebSocketURL(): Promise<string | null> {
        const url: string = `${this.browserWsEndpoint}/json/version`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

            const data: BrowserVersionResponse = await response.json();
            console.log('✅ Browser Info:', JSON.stringify(data, null, 2));
            return data.webSocketDebuggerUrl || null;
        } catch (error) {
            console.error(`❌ Failed to fetch browser WebSocket URL from ${url}:`, (error as Error).message);
            return null;
        }
    }

    static async connectToBrowser(retries: number = MAX_RETRIES): Promise<Browser> {
        for (let attempt = 1; attempt <= retries; attempt++) {
            console.log(`🔍 Attempt ${attempt}: Checking browser status at ${this.browserWsEndpoint}...`);
            const webSocketURL = await this.getBrowserWebSocketURL();

            if (!webSocketURL) {
                const waitTime = attempt * BASE_WAIT_TIME;
                console.warn(`⚠️ Browser status check failed. Retrying in ${waitTime / 1000} seconds...`);
                await new Promise(res => setTimeout(res, waitTime));
                continue; // Skip connection attempt if status check fails
            }

            try {
                console.log(`🚀 Attempt ${attempt}: Connecting to browser at ${this.browserWsEndpoint}...`);
                const browser: Browser = await puppeteer.connect({ browserURL: this.browserWsEndpoint });
                console.log('✅ Successfully connected to browser');
                return browser;
            } catch (error) {
                console.error(`❌ Connection attempt ${attempt} failed: ${(error as Error).message}`);
                if (attempt === retries) {
                    throw new Error('❌ Failed to connect to browser after multiple attempts.');
                }

                const waitTime = attempt * BASE_WAIT_TIME;
                console.log(`⏳ Retrying in ${waitTime / 1000} seconds...`);
                await new Promise(res => setTimeout(res, waitTime));
            }
        }
        throw new Error('❌ Could not connect to the browser after all retries.');
    }
}