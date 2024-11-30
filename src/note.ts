import YAML from "yaml";



const FRONTMATTER_START_SIGIL = "---\n";
const FRONTMATTER_END_SIGIL = "\n---\n";

export class MarkdownNote {
    public constructor(
        public readonly path: string,
        private text: string,
        private frontmatter?: Record<string, unknown>
    ) {  }

    public static async loadFile(filepath: string): Promise<MarkdownNote> {
        const data = await Bun.file(filepath).text();

        if(data.startsWith("---")) {
            // Has frontmatter!
            const frontmatterStart = data.indexOf(FRONTMATTER_START_SIGIL) + FRONTMATTER_START_SIGIL.length;
            const frontmatterEnd = data.indexOf(FRONTMATTER_END_SIGIL, frontmatterStart);
            const frontmatterText = data.slice(frontmatterStart, frontmatterEnd);

            const noteText = data.slice(frontmatterEnd + FRONTMATTER_END_SIGIL.length);
            return new MarkdownNote(filepath, noteText, YAML.parse(frontmatterText));
        } else {
            return new MarkdownNote(filepath, data);
        }
    }

    public getText() { return this.text; }
    public setText(value: string) { this.text = value; }
    public updateText(updateFn: (text: string) => string) {
        this.text = updateFn(this.text);
    }

    public getFrontmatter() { return this.frontmatter; }
    public setFrontmatter(data: Record<string, unknown> | undefined) { this.frontmatter = data; }
    public updateFrontmatter(
        updateFn: (frontmatter: Record<string, unknown>) => Record<string, unknown> | undefined
    ) {
        this.frontmatter = updateFn(this.frontmatter ?? {});
    }

    public async save(): Promise<void> {
        if(this.frontmatter) {
            const frontmatterText = YAML.stringify(this.frontmatter, { indent: 4 });
            const filedata = ["---", frontmatterText, "---", this.text].join("\n");
            await Bun.write(this.path, filedata);
        } else {
            await Bun.write(this.path, this.text);
        }
    }
}