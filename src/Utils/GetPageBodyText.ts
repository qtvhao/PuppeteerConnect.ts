import { Page } from "puppeteer";
export class GetPageBodyText {
    public static async getInnerText(page: Page): Promise<string> {
        return await page.evaluate(() => (document.body || {innerText: ''}).innerText || "");
    }
}
