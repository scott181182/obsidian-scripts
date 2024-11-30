import path from "node:path";

import { Command } from "commander";

import { name, version } from "../package.json";
import { updateProjectNotes } from "./projects";
import { CustomError } from "./errors";



const program = new Command(name)
    .version(version);

program.command("update-projects")
    .description("update project notes based on GitHub repositories")
    .option("-p, --project-dir <path>", "Specify a project directory (default: 'Programing/Projects'")
    .option("-L, --limit <path>", "Specify a limit for the number of repos to check (default: 200")
    .action((opts) => {
        const projectNoteDir = "projectDir" in opts ?
            opts.projectDir :
            path.join("Programming", "Projects");
        const repoLimit = opts.limit ? parseInt(opts.limit) : 200;

        return updateProjectNotes({
            projectNoteDir,
            repoLimit,
        })
    });

await program.parseAsync()
    .catch((err) => {
        if(err instanceof CustomError) {
            console.error(err.message);
        } else {
            throw err;
        }
    });
