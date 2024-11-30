


export class Templater {
    private readonly requiredVariables: string[];

    public constructor(
        private readonly templateStr: string,
    ) {
        this.requiredVariables = [
            ...templateStr.matchAll(/\$\{(\w+)\}/g).map((m) => m[1])
        ];
        console.log(this.requiredVariables);
    }

    public static async load(templatePath: string) {
        const templateStr = await Bun.file(templatePath).text();

        return new Templater(templateStr);
    }

    public templateString(data: Record<string, string>): string {
        // Validate data.
        const missingVariables = this.requiredVariables.filter((k) => !(k in data));
        if(missingVariables.length) {
            throw new Error(`Missing the following variables to make template: ${missingVariables.join(", ")}`)
        }

        let tpl = this.templateStr;
        for(const key of this.requiredVariables) {
            tpl = tpl.replaceAll(`\${${key}}`, data[key]);
        }
        return tpl;
    }
    public async templateFile(outputPath: string, data: Record<string, string>): Promise<void> {
        await Bun.write(outputPath, this.templateString(data));
    }
}