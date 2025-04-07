export class UploadFile {
    static async uploadFile(page: any, url: string, selector: string, file: string) {
        await page.goto(url);

        await page.waitForSelector(selector);
        let fileInput = await page.$(selector);
        await fileInput.uploadFile(file);
    }
}
