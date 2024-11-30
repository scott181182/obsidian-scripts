import { Glob } from "bun";
import path from "node:path";

import { fetchRepoList, type RepoInfo } from "./github";
import { MarkdownNote } from "./note";
import { Templater } from "./template";
import { z } from "zod";
import { isDeepEqual, omit } from "remeda";



interface ProjectNoteGithubInfo {
    id: string;
    name: string;
    nameWithOwner: string;
    url: string;
    isPrivate: boolean;
    isArchived: boolean;
    lastUpdated: string;
    noteLastUpdated: string;
}
/** Map from GitHub project ID to project note path. */
type ProjectNoteMap = Record<string, string>;
interface ProjectNote {
    path: string;
    ghinfo: ProjectNoteGithubInfo;
}

async function getNoteRepoId(filepath: string): Promise<string | undefined> {
    const note = await MarkdownNote.loadFile(filepath);
    const frontmatter = note.getFrontmatter();

    if(
        frontmatter && "github" in frontmatter &&
        frontmatter.github && typeof frontmatter.github === "object" &&
        "id" in frontmatter.github && typeof frontmatter.github.id === "string"
    ) {
        return frontmatter.github.id;
    }
}
async function getProjectNotes(projectNoteDir: string): Promise<ProjectNoteMap> {
    const notes: ProjectNoteMap = {};

    const projectNoteGlob = new Glob("**/*.md");
    for await(const notePath of projectNoteGlob.scan({ cwd: projectNoteDir, absolute: true })) {
        const repoId = await getNoteRepoId(notePath);
        if(repoId) {
            notes[repoId] = notePath;
        }
    }

    return notes;
}



function repoToNoteInfo(ghinfo: RepoInfo): ProjectNoteGithubInfo {
    return {
        id: ghinfo.id,
        name: ghinfo.name,
        nameWithOwner: ghinfo.nameWithOwner,
        url: ghinfo.url,
        isPrivate: ghinfo.isPrivate,
        isArchived: ghinfo.isArchived,
        lastUpdated: ghinfo.updatedAt,
        noteLastUpdated: new Date().toISOString()
    }
}

async function updateNoteFile(noteConfig: ProjectNote) {
    const note = await MarkdownNote.loadFile(noteConfig.path);

    const currentFrontmatter = note.getFrontmatter();
    if(
        currentFrontmatter &&
        isDeepEqual(
            omit(currentFrontmatter.github as any, [ "noteLastUpdated" ]),
            omit(noteConfig.ghinfo, [ "noteLastUpdated" ])
        )
    ) {
        return false;
    }

    note.updateFrontmatter((frontmatter) => ({
        ...frontmatter,
        github: noteConfig.ghinfo
    }));

    await note.save();
    return true;
}
async function createNoteFile(noteConfig: ProjectNote, repo: RepoInfo, noteTemplate: Templater) {
    const note = new MarkdownNote(
        noteConfig.path,
        noteTemplate.templateString({
            name: repo.name,
            description: repo.description || "Note template for a project from GitHub"
        }),
        { github: noteConfig.ghinfo }
    );

    await note.save();
}



const IndexConfigSchema = z.object({
    ignore_repos: z.string().array().optional(),
});
async function updateConfigFromIndex(config: ProjectNoteConfig) {
    const indexNote = await MarkdownNote.loadFile(path.join(config.projectNoteDir, "Index.md"))
        .catch(() => undefined);
    if(!indexNote) {
        console.warn("No index note to get configuration from");
        return;
    }

    const frontmatter = indexNote.getFrontmatter();
    if(!frontmatter) {
        console.warn("Index frontmatter does not have configuration");
        return;
    }

    const indexConfig = IndexConfigSchema.safeParse(frontmatter);
    if(!indexConfig.success) {
        console.warn("Could not parse config from index frontmatter");
        return;
    }
    if(indexConfig.data.ignore_repos) {
        config.ignoreRepos = [
            ...(config.ignoreRepos ?? []),
            ...(indexConfig.data.ignore_repos)
        ]
    }
}



export interface ProjectNoteConfig {
    projectNoteDir: string;
    repoLimit?: number;
    ignoreRepos?: string[]
}
export async function updateProjectNotes(config: ProjectNoteConfig) {
    await updateConfigFromIndex(config);
    const noteTemplate = await Templater.load(path.resolve(import.meta.dir, "..", "assets", "project-note.tpl.md"));

    console.log("Fetching projects from GitHub...");
    const repos = await fetchRepoList(config.repoLimit);
    const projectNoteMap = await getProjectNotes(config.projectNoteDir);
    
    for(const repo of repos) {
        if(config.ignoreRepos?.includes(repo.nameWithOwner)) {
            console.log(`Skipping ${repo.nameWithOwner}`);
            continue;
        }

        const noteConfig: ProjectNote = {
            path: path.join(config.projectNoteDir, `${repo.name}.md`),
            ghinfo: repoToNoteInfo(repo)
        }

        // Check if notes exist already.
        if(repo.id in projectNoteMap) {
            noteConfig.path = projectNoteMap[repo.id];
            const didUpdate = await updateNoteFile(noteConfig);
            if(didUpdate) {
                console.info(`Existing notes updated for ${repo.nameWithOwner}`);
            } else {
                console.info(`No updates for ${repo.nameWithOwner}`);
            }
        } else {
            console.info(`No notes found for ${repo.nameWithOwner}. Creating new one...`);
            await createNoteFile(noteConfig, repo, noteTemplate);
        }
    }

    console.log("Done!");
}