import { bashTool } from '../src/tools/bash';
import { gitTools } from '../src/tools/git';
import { astAnalyzeTool } from '../src/tools/ast';
import { todoListTools } from '../src/tools/todo';
import { filesystemTools } from '../src/tools/fileSystem';
import { writeToChatHistoryTool, readChatHistoryTool } from '../src/tools/chat-history/chatHistoryTools';
import { thinkTool } from '../src/tools/task/thinkTool';

async function testBashTool() {
    console.log('=== Bash Tool Test ===');
    const result = await bashTool.invoke({ command: 'echo "hello world"' });
    console.log(`✓ Bash: ${(result as string).trim()}`);
}

async function testGitTools() {
    console.log('=== Git Tools Test ===');
    for (const tool of gitTools) {
        try {
            const result = await tool.invoke({});
            console.log(`✓ ${tool.name}: ${typeof result === 'string' ? result.slice(0, 80) : 'ok'}`);
        } catch (e: any) {
            console.log(`  ${tool.name}: ${e.message?.slice(0, 60)}`);
        }
    }
}

async function testASTTool() {
    console.log('=== AST Tool Test ===');
    const result = await astAnalyzeTool.invoke({
        file_path: 'src/llm/llm.ts',
        analysis_type: 'summary'
    });
    console.log(`✓ AST: ${(result as string).slice(0, 100)}`);
}

async function testTodoTools() {
    console.log('=== Todo Tools Test ===');
    const [writeTodos, readTodos] = todoListTools;
    const writeResult = await writeTodos.invoke({
        filename: 'test-suite',
        todos: [
            { task: 'Test task 1', assigned_to: 'coder', status: 'pending' },
        ]
    });
    console.log(`✓ Write todos: ${(writeResult as string).slice(0, 60)}`);

    const readResult = await readTodos.invoke({ filename: 'test-suite' });
    console.log(`✓ Read todos: ${(readResult as string).slice(0, 60)}`);
}

async function testThinkTool() {
    console.log('=== Think Tool Test ===');
    const result = await thinkTool.invoke({ reflection: 'Testing the think tool' });
    console.log(`✓ Think: ${(result as string).slice(0, 80)}`);
}

async function testChatHistory() {
    console.log('=== Chat History Test ===');
    const writeResult = await writeToChatHistoryTool.invoke({
        messages: [{ role: 'user', content: 'test message', userId: 'test', projectId: 'test' }]
    });
    console.log(`✓ Write history: ${writeResult}`);

    const readResult = await readChatHistoryTool.invoke({ userId: 'test', projectId: 'test' });
    console.log(`✓ Read history: ${(readResult as string).slice(0, 80)}`);
}

async function runAllTests() {
    console.log('\n============================');
    console.log('  CodeCraft AI - Tool Tests');
    console.log('============================\n');

    try { await testBashTool(); } catch (e: any) { console.error('✗ Bash:', e.message); }
    try { await testGitTools(); } catch (e: any) { console.error('✗ Git:', e.message); }
    try { await testASTTool(); } catch (e: any) { console.error('✗ AST:', e.message); }
    try { await testTodoTools(); } catch (e: any) { console.error('✗ Todo:', e.message); }
    try { await testThinkTool(); } catch (e: any) { console.error('✗ Think:', e.message); }
    try { await testChatHistory(); } catch (e: any) { console.error('✗ ChatHistory:', e.message); }

    console.log('\n============================');
    console.log('  All Tool Tests Complete');
    console.log('============================\n');
}

runAllTests();
