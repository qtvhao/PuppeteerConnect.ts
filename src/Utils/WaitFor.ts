import { Page } from "puppeteer"

export class WaitFor {
    static async waitForTextInBody(page: Page, text: string, maxAttempts: number = 50, delayMs: number = 8000): Promise<void> {
        const now = new Date();
        for (let i = 0; i < maxAttempts; i++) {
            console.log('Waiting for text to appear, attempt:', i, ' elapsed:', (new Date().getTime() - now.getTime()) / 1000, 's');
            await new Promise(resolve => setTimeout(resolve, delayMs));
            const body = await page.$('body');
            const bodyText = await page.evaluate(body => body?.innerText || '', body);
            console.log('Body text:', bodyText.replace(/\s+/g, ' '));
            if (bodyText.indexOf(text) !== -1) {
                return;
            }
        }
        throw new Error(`Timeout: Text "${text}" not found in page body after ${maxAttempts} attempts.`);
    }
}
