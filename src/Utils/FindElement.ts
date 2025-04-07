import { Page } from 'puppeteer'

export class FindElement {
    static async waitForElementContainingText(page: Page, textToMatch: string, maxRetries: number = 100, delayMs: number = 8000): Promise<any> {
        console.log('Waiting for element containing text:', textToMatch);
        for (let i = 0; i < maxRetries; i++) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
            const elements = await page.$$('div');
            for (const element of elements) {
                const text = await page.evaluate(el => el.textContent?.replace(/\s+/g, ' ') || '', element);
                if (text.includes(textToMatch)) {
                    return element;
                }
            }
        }
        throw new Error(`Element containing text "${textToMatch}" not found after ${maxRetries} attempts.`);
    }
}
