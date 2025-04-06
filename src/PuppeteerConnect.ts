import puppeteer, { Browser } from 'puppeteer';
import {spawn} from 'child_process'
import { BrowserVersionResponse } from './definitions.d/BrowserVersionResponse';
import path from 'path';

const MAX_RETRIES: number = 3; // Maximum retry attempts
const BASE_WAIT_TIME: number = 2000; // Base wait time in milliseconds
const BROWSER_WS_ENDPOINT: string = process.env.BROWSER_WS_ENDPOINT || 'http://localhost:21222'; // Default endpoint

/**
 * Connects to a Puppeteer-controlled browser using `BROWSER_WS_ENDPOINT`, with retries.
 */
export class PuppeteerConnect {
    constructor(
        private browserWsEndpoint: string = BROWSER_WS_ENDPOINT,
        private retries: number = MAX_RETRIES
    ) {}

    private async getBrowserWebSocketURL(): Promise<string | null> {
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

    public async connectToBrowser(): Promise<Browser> {
        for (let attempt = 1; attempt <= this.retries; attempt++) {
            console.log(`🔍 Attempt ${attempt}: Checking browser status at ${this.browserWsEndpoint}...`);
            const webSocketURL = await this.getBrowserWebSocketURL();

            if (!webSocketURL) {
                const waitTime = attempt * BASE_WAIT_TIME;
                console.warn(`⚠️ Browser status check failed. Retrying in ${waitTime / 1000} seconds...`);
                await new Promise(res => setTimeout(res, waitTime));
                continue;
            }

            try {
                console.log(`🚀 Attempt ${attempt}: Connecting to browser at ${this.browserWsEndpoint}...`);
                const browser: Browser = await puppeteer.connect({ browserURL: this.browserWsEndpoint });
                console.log('✅ Successfully connected to browser');
                return browser;
            } catch (error) {
                console.error(`❌ Connection attempt ${attempt} failed: ${(error as Error).message}`);
                if (attempt === this.retries) {
                    throw new Error('❌ Failed to connect to browser after multiple attempts.');
                }

                const waitTime = attempt * BASE_WAIT_TIME;
                console.log(`⏳ Retrying in ${waitTime / 1000} seconds...`);
                await new Promise(res => setTimeout(res, waitTime));
            }
        }
        throw new Error('❌ Could not connect to the browser after all retries.');
    }

    public static startLocalBrowser(dataDir: string = 'puppeteer_data'): void {
        if (process.platform !== 'darwin') {
            throw new Error('❌ startLocalBrowser is only supported on macOS (darwin platform).');
        }

        const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        const args = [
            chromePath,
            '--remote-debugging-port=9222',
            `--user-data-dir=${path.resolve(process.cwd(), dataDir)}`,
            '--disable-dev-shm-usage',
            '--disable-software-rasterizer',
            '--disable-proxy-certificate-handler',
            '--no-sandbox',
            '--no-first-run',
            '--disable-features=PrivacySandboxSettings4',
            '--no-zygote',
            '--user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15"'
        ];

        const chrome = spawn('open', ['-a', 'Google Chrome', '--args', ...args], {
            detached: true,
            stdio: 'ignore'
        });

        chrome.on('error', (err) => {
            console.error('❌ Failed to start Chrome process:', err);
        });

        chrome.on('exit', (code, signal) => {
            if (code !== null) {
                console.log(`⚠️ Chrome process exited with code ${code}`);
            } else if (signal !== null) {
                console.log(`⚠️ Chrome process was killed with signal ${signal}`);
            }
        });

        chrome.unref();
        console.log('🚀 Started local Chrome with remote debugging on port 9222...');

        const handleExit = () => {
            console.log('🛑 Parent process exiting, attempting to terminate Chrome...');
            try {
                process.kill(chrome.pid!);
            } catch (err) {
                console.warn('⚠️ Failed to kill Chrome process:', err);
            }
        };

        process.on('exit', handleExit);
        process.on('SIGINT', () => {
            handleExit();
            process.exit();
        });
        process.on('SIGTERM', () => {
            handleExit();
            process.exit();
        });
    }

    public static async connectLocalBrowser(dataDir: string = 'puppeteer_data'): Promise<Browser> {
        this.startLocalBrowser(dataDir);

        const maxAttempts = 10;
        const waitInterval = 1000; // 1 second
        const connector = new PuppeteerConnect('http://localhost:9222');

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const wsUrl = await connector.getBrowserWebSocketURL();
            if (wsUrl) {
                return await connector.connectToBrowser();
            }

            console.log(`⌛ Waiting for local browser... (${attempt}/${maxAttempts})`);
            await new Promise(res => setTimeout(res, waitInterval));
        }

        throw new Error('❌ Timed out waiting for local browser to be ready.');
    }
}
