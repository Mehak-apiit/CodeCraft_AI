import { bashTool } from './src/tools/bash';
import { gitTools } from './src/tools/git';
import { astAnalyzeTool } from './src/tools/ast';
import { todoListTools } from './src/tools/todo';
import { filesystemTools } from './src/tools/fileSystem';

async function testTools() {
    console.log('=== Testing Bash Tool ===');
    const bashResult = await bashTool.invoke({ command: 'echo "Hello from bash tool"' });
    console.log(bashResult);

    console.log('\n=== Testing Git Tools ===');
    const gitDiff = await gitTools[0].invoke({});
    console.log('git_diff:', typeof gitDiff === 'string' ? gitDiff.slice(0, 100) : gitDiff);

    console.log('\n=== Testing AST Tool ===');
    const astResult = await astAnalyzeTool.invoke({
        file_path: 'src/tools/bash.ts',
        analysis_type: 'summary'
    });
    console.log('ast_analyze:', typeof astResult === 'string' ? astResult.slice(0, 200) : astResult);

    console.log('\n=== Testing Todo Tools ===');
    const [writeTodos, readTodos] = todoListTools;
    const writeResult = await writeTodos.invoke({
        filename: 'test-tasks',
        todos: [
            { task: 'Test task 1', assigned_to: 'coder', status: 'pending' },
            { task: 'Test task 2', assigned_to: 'reviewer', status: 'in_progress' }
        ]
    });
    console.log('write_todos:', typeof writeResult === 'string' ? writeResult.slice(0, 200) : writeResult);
    const readResult = await readTodos.invoke({ filename: 'test-tasks' });
    console.log('read_todos:', typeof readResult === 'string' ? readResult.slice(0, 200) : readResult);

    console.log('\n=== Testing FileSystem Tools ===');
    const [readFile] = filesystemTools;
    const fileResult = await readFile.invoke({ file_path: 'src/llm/llm.ts' });
    console.log('read_file:', typeof fileResult === 'string' ? fileResult.slice(0, 200) : fileResult);

    console.log('\n=== All core tools working! ===');
}

testTools().catch(console.error);
