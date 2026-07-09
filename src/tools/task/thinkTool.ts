import { tool } from "@langchain/core/tools";
import { z } from "zod";
/*
Strategic reflection tool for research planning
 */

export const think_tool = tool(
    async({reflection}) =>{
        return `<think>${reflection}</think>`;

    },
    {
        name:"think_tool",
        description: `A scratchapd to reason before acting on code. Free and instant - no external calls.
        
        Use it:
        - Before editing a file -> did impact_analysis show risk? am I editing the right place?
        -After ast_analyze -> which functions actually need to change ?
        - Before write_file -> does this file already exist? does it follow project conventions?
        - After a bash error -> what exactly failed? is it missing dep,syntax error, or wrong command?
        - Before a refactor -> have I read all affected files? do I understand the full blast radius?
        - After build_import_graph -> which entry points and central files should I avoid touching?
        - Before updating agent memory -> what did I actually learn that's worth persisting?

        Reflection structure:
        1. What I know so far (files read, graph built, errors seen)
        2. Risk or uncertainty (what could break,what I have not checked)
        3. Decision - proceed with edit / read more first / ask user
        `,
        schema: z.object({
            reflection: z.string().describe("Your reasoning - current state, risks and next action"),
        }),

    }
);