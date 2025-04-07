export class ClickButton {
    static async clickButtonMultipleTimes(page: any, selector: string, times: number = 1, delayMs: number = 2000) {
        for (let i = 0; i < times; i++) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
            await page.waitForSelector(selector);
            await page.click(selector);
        }

        await new Promise(resolve => setTimeout(resolve, delayMs));
    }
}
