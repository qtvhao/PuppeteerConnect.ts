export class ClickLabel {
    static async clickElementByText(page: import('puppeteer').Page, selector: string, labelText: string): Promise<boolean> {
        await page.waitForSelector(selector);
        const elements = await page.$$(selector);
        for (const element of elements) {
            const text = await page.evaluate((el: Element) => el.textContent, element);
            console.log('Element text:', JSON.stringify(text));
            if (text?.trim().toLowerCase() === labelText.trim().toLowerCase()) {
                await element.click();
                return true;
            }
        }
        return false;
    }
}