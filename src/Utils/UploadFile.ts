import { Page, ElementHandle } from "puppeteer";

export class UploadFile {
    static async uploadFile(page: Page, url: string, selector: string, file: string) {
        await page.goto(url);

        await page.waitForSelector(selector);
        const fileInput = await page.$(selector);
        if (!fileInput) throw new Error(`Could not find element with selector: ${selector}`);
        await (fileInput as ElementHandle<HTMLInputElement>).uploadFile(file);
    }
}
