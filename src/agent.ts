import 'dotenv/config';
import { ChatCohere } from '@langchain/cohere';
import { MemorySaver } from '@langchain/langgraph-checkpoint';
import { createReactAgent } from '@langchain/langgraph/dist/prebuilt';
import { BaseMessage } from '@langchain/core/messages';

import { bashTool } from './tools/bash';
import { gitDiffTool, gitLogTool, gitStatusTool } from './tools/git';
import {
  readFileTool,
  writeFileTool,
  editFileTool,
  fileTreeTool,
  listDirTool,
  searchFileTool,
} from './tools/fileSystem';
import { astAnalyzeTool } from './tools/ast';
import {
  buildImportGraphTool,
  queryImportGraphTool,
  impactAnalysisTool,
} from './tools/importGraph';
import {
  write_todos,
  read_todos,
  update_todos,
  get_next_runnable_tasks,
} from './tools/todo';
import { embedCodebaseTool, queryCodebaseTool } from './tools/rag';
import {
  readAgentIndexTool,
  updateAgentIndexTool,
  readAgentModuleTool,
  writeAgentModuleTool,
  listAgentModulesTool,
  readEmbeddingsIndexTool,
} from './tools/ProjectContextBuilder';

const allTools = [
  bashTool,
  gitDiffTool,
  gitLogTool,
  gitStatusTool,
  readFileTool,
  writeFileTool,
  editFileTool,
  fileTreeTool,
  listDirTool,
  searchFileTool,
  astAnalyzeTool,
  buildImportGraphTool,
  queryImportGraphTool,
  impactAnalysisTool,
  write_todos,
  read_todos,
  update_todos,
  get_next_runnable_tasks,
  embedCodebaseTool,
  queryCodebaseTool,
  readAgentIndexTool,
  updateAgentIndexTool,
  readAgentModuleTool,
  writeAgentModuleTool,
  listAgentModulesTool,
  readEmbeddingsIndexTool,
];

const model = new ChatCohere({
  model: 'command-a-03-2025',
  temperature: 0,
  apiKey: process.env.COHERE_API_KEY,
});

const memory = new MemorySaver();

export const agent = createReactAgent({
  llm: model,
  tools: allTools,
  checkpointSaver: memory,
  messageModifier:
    'You are a helpful AI coding assistant called CodeCraft AI. ' +
    'You have access to tools for reading/writing files, running shell commands, ' +
    'managing git, analyzing code structure, building import graphs, ' +
    'managing tasks/todos, and working with a RAG-based code index. ' +
    'Always explain what you are doing before taking action. ' +
    'Prefer reading files before editing them to understand context.',
});

async function main() {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('CodeCraft AI Agent');
  console.log('Type "exit" to quit, "clear" to reset memory\n');

  const askQuestion = (): Promise<string> =>
    new Promise((resolve) => rl.question('You: ', resolve));

  let running = true;
  while (running) {
    const input = (await askQuestion()).trim();
    if (!input) continue;

    if (input.toLowerCase() === 'exit') {
      running = false;
      break;
    }

    if (input.toLowerCase() === 'clear') {
      await memory.deleteThread('default');
      console.log('Memory cleared.\n');
      continue;
    }

    try {
      const stream = await agent.stream(
        { messages: [{ role: 'user', content: input }] },
        { configurable: { thread_id: 'default' } }
      );

      for await (const event of stream) {
        if (event.agent?.messages) {
          const msgs = event.agent.messages as BaseMessage[];
          if (msgs[0]?.content) {
            console.log(`\nAgent: ${msgs[0].content}\n`);
          }
        }
        if (event.tools?.messages) {
          const toolMsgs = event.tools.messages as BaseMessage[];
          for (const toolMsg of toolMsgs) {
            const name = (toolMsg as any).name || 'tool';
            const content =
              typeof toolMsg.content === 'string'
                ? toolMsg.content
                : JSON.stringify(toolMsg.content);
            const preview =
              content.length > 200 ? content.slice(0, 200) + '...' : content;
            console.log(`  [${name}] ${preview}`);
          }
        }
      }
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
    }
  }

  rl.close();
  process.exit(0);
}

if (require.main === module) {
  main();
}
