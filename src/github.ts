import { readableStreamToJSON } from "bun";

import { z } from "zod";

import { CommandNotFoundError } from "./errors";



const RepoInfoSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    url: z.string().url(),
    visibility: z.enum([ "PUBLIC", "PRIVATE" ]),
    updatedAt: z.string().datetime(),
    nameWithOwner: z.string(),
    isPrivate: z.boolean(),
    isArchived: z.boolean(),
});
export type RepoInfo = z.infer<typeof RepoInfoSchema>;



export async function fetchRepoList(limit=200) {
    try {
        const res = Bun.spawn({
            cmd: ["gh", "repo", "list", "-L", limit.toString(), "--json", Object.keys(RepoInfoSchema.shape).join(",")],
            stderr: "pipe",
            stdout: "pipe"
        });
        
        const data = await readableStreamToJSON(res.stdout);
        return RepoInfoSchema.array().parse(data);
    } catch(err) {
        if(err instanceof TypeError && err.message.includes("Executable not found in $PATH")) {
            throw new CommandNotFoundError("gh");
        }
        throw err;
    }
}