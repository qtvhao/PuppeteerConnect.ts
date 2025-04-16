import puppeteer, { Browser, Page } from 'puppeteer';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { BrowserVersionResponse } from './definitions.d/BrowserVersionResponse';
import path from 'path';
const execAsync = promisify(exec);

const MAX_RETRIES: number = 12; // Maximum retry attempts
const BASE_WAIT_TIME: number = 2000; // Base wait time in milliseconds
const BROWSER_WS_ENDPOINT: string = process.env.BROWSER_WS_ENDPOINT || 'http://localhost:21222'; // Default endpoint

/**
 * Connects to a Puppeteer-controlled browser using `BROWSER_WS_ENDPOINT`, with retries.
 */
export class PuppeteerConnect {
    constructor(
        private browserWsEndpoint: string = BROWSER_WS_ENDPOINT,
        private retries: number = MAX_RETRIES
    ) { }

    public static async thereNoChromeProcessesExists(): Promise<boolean> {
        try {
            const { stdout } = await execAsync("pgrep -x 'Google Chrome'");
            return stdout.trim() === '';
        } catch (error) {
            // If pgrep fails (e.g. no processes found), assume no Chrome processes are running
            return true;
        }
    }

    private async getBrowserWebSocketURL(): Promise<string | null> {
        const url: string = `${this.browserWsEndpoint}/json/version`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

            const data: BrowserVersionResponse = await response.json();
            // console.log('✅ Browser Info:', JSON.stringify(data, null, 2));
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

    public static async startLocalBrowser(dataDir: string = 'puppeteer_data'): Promise<string> {
        if (process.platform !== 'darwin') {
            throw new Error('❌ startLocalBrowser is only supported on macOS (darwin platform).');
        }

        const args = [
            'https://example.com',
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

        const endpoint = 'http://localhost:9222';
        const connector = new PuppeteerConnect(endpoint);
        let attempts = 0;
        let webSocketURL: string | null = null;

        while (attempts < MAX_RETRIES && !webSocketURL) {
            webSocketURL = await connector.getBrowserWebSocketURL();
            if (!webSocketURL) {
                const waitTime = (attempts + 1) * BASE_WAIT_TIME;
                console.warn(`⚠️ Attempt ${attempts + 1}: Unable to fetch WebSocket URL. Retrying in ${waitTime / 1000} seconds...`);
                await new Promise(res => setTimeout(res, waitTime));
            }
            attempts++;
        }

        if (!webSocketURL) {
            throw new Error('❌ Failed to retrieve browser WebSocket URL after maximum retries.');
        }

        return endpoint;
    }

    public async connectLocalBrowser(dataDir: string = 'puppeteer_data'): Promise<Browser> {
        const endpoint = await PuppeteerConnect.startLocalBrowser(dataDir);
        this.browserWsEndpoint = endpoint;
        return await this.connectToBrowser();
    }

    /**
     * Retrieves the first page from the connected browser.
     */
    public async getFirstPage(viewport: { width: number; height: number } = { width: 1440, height: 800 }): Promise<Page> {
        const browser = await this.connectToBrowser();
        await new Promise(r => setTimeout(r, 2_000))
        const pages = await browser.pages();
        if (pages.length === 0) {
            throw new Error('❌ No pages found in the browser.');
        }
        await pages[0].setViewport(viewport);

        return pages[0];
    }

    public async waitForPageLogin(targetUrl: string, loggedInHostname: string, pollInterval: number = 8000): Promise<void> {
        const page = await this.getFirstPage();
        await page.goto(targetUrl);
        let url = page.url();
        console.log('Initial URL:', url);

        if (new URL(url).hostname !== loggedInHostname) {
            while (true) {
                console.log('Waiting for login...');
                await new Promise(resolve => setTimeout(resolve, pollInterval));
                url = page.url();
                console.log('Current URL:', url);
                if (new URL(url).hostname === loggedInHostname) {
                    console.log('✅ Logged in');
                    break;
                } else {
                    console.log('❌ Not logged in yet');
                }
            }
        } else {
            console.log('✅ Already logged in');
        }
    }
    
    /**
     * Disconnects from the currently connected Puppeteer browser.
     */
    public async disconnectBrowser(browser: Browser): Promise<void> {
        try {
            await browser.disconnect();
            console.log('🔌 Disconnected from the browser.');
        } catch (error) {
            console.error('❌ Failed to disconnect from the browser:', (error as Error).message);
        }
    }

    /**
     * Kills all running "Google Chrome" processes (macOS only).
     */
    public static async killAllChromeProcesses(): Promise<void> {
        if (process.platform !== 'darwin') {
            throw new Error('❌ killAllChromeProcesses is only supported on macOS (darwin platform).');
        }

        const kill = spawn('killall', ['-9', 'Google Chrome']);
        console.log('🔪 Attempting to kill all "Google Chrome" processes...');

        await new Promise<void>((resolve, reject) => {
            kill.on('error', (err) => {
                console.error('❌ Failed to execute killall:', err);
                reject(err);
            });

            kill.on('exit', (code, signal) => {
                console.log('🧼 Finished attempting to kill processes.');
                if (code !== null) {
                    console.log(`🛑 killall exited with code ${code}`);
                } else if (signal !== null) {
                    console.log(`🛑 killall was killed with signal ${signal}`);
                }
                resolve();
            });
        });
        while (true) {
            if (await PuppeteerConnect.thereNoChromeProcessesExists()) {
                await new Promise(r=>setTimeout(r, 1_000))
                break;
            }
        }
    }
}
