export class ClickLabel {
    static async clickRadioLabelByText(page: import('puppeteer').Page, labelText: string) {
        await page.waitForSelector('#radioLabel');
        const radioLabels = await page.$$('#radioLabel');
        for (const radioLabel of radioLabels) {
            const text = await page.evaluate((element: Element) => element.textContent, radioLabel);
            console.log('Radio label text:', JSON.stringify(text));
            if (text === labelText) {
                await radioLabel.click();
                break;
            }
        }
    }
}