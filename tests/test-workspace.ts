import { WORKSPACE_ROOT, ensureWorkspaceDir } from '../src/config/paths';
import { writeFileTool, readFileTool, editFileTool, listDirTool } from '../src/tools/fileSystem';
import { bashTool } from '../src/tools/bash';
import { astAnalyzeTool } from '../src/tools/ast';
import { gitStatusTool } from '../src/tools/git';
import fs from 'fs';
import path from 'path';

const TEST_FILE = 'workspace-test-file.txt';
const TEST_CONTENT = 'Hello from unified workspace!\nLine 2 of test.';

async function testWorkspaceRoot() {
    console.log('=== Workspace Root Test ===');
    console.log(`  WORKSPACE_ROOT: ${WORKSPACE_ROOT}`);
    const expected = path.resolve(process.cwd(), 'public', 'agent-working-dir');
    if (WORKSPACE_ROOT !== expected) {
        throw new Error(`WORKSPACE_ROOT mismatch: ${WORKSPACE_ROOT} !== ${expected}`);
    }
    console.log('  ✓ WORKSPACE_ROOT points to public/agent-working-dir');
}

async function testEnsureWorkspace() {
    console.log('=== Ensure Workspace Test ===');
    ensureWorkspaceDir();
    if (!fs.existsSync(WORKSPACE_ROOT)) {
        throw new Error('Workspace directory not created');
    }
    console.log('  ✓ ensureWorkspaceDir() creates directory');
}

async function testWriteReadCycle() {
    console.log('=== Write → Read Cycle ===');
    const writeResult = await writeFileTool.invoke({ file_path: TEST_FILE, content: TEST_CONTENT });
    console.log(`  write_file: ${(writeResult as string).slice(0, 60)}`);

    const readResult = await readFileTool.invoke({ file_path: TEST_FILE });
    const content = readResult as string;
    if (!content.includes('Hello from unified workspace!')) {
        throw new Error('Read content does not match written content');
    }
    console.log('  ✓ write_file → read_file roundtrip works');
}

async function testEditFile() {
    console.log('=== Edit File Test ===');
    const editResult = await editFileTool.invoke({
        file_path: TEST_FILE,
        old_str: 'Line 2 of test.',
        new_str: 'Line 2 EDITED.'
    });
    console.log(`  edit_file: ${(editResult as string).slice(0, 60)}`);

    const readResult = await readFileTool.invoke({ file_path: TEST_FILE });
    if (!(readResult as string).includes('Line 2 EDITED.')) {
        throw new Error('Edit not applied');
    }
    console.log('  ✓ edit_file works');
}

async function testBashSeesWorkspaceFiles() {
    console.log('=== Bash Sees Workspace Files ===');
    const result = await bashTool.invoke({ command: `ls ${TEST_FILE}` });
    const output = result as string;
    if (!output.includes(TEST_FILE)) {
        throw new Error(`Bash cannot see workspace files: ${output}`);
    }
    console.log('  ✓ bash ls shows files written by write_file');
}

async function testAstAnalyzesWorkspaceFile() {
    console.log('=== AST Analyzes Workspace File ===');
    const tsFile = 'workspace-test.ts';
    const tsContent = `export function hello(): string {
  return "world";
}
export class TestClass {
  method() {}
}`;
    await writeFileTool.invoke({ file_path: tsFile, content: tsContent });

    const result = await astAnalyzeTool.invoke({ file_path: tsFile });
    const output = result as string;
    if (!output.includes('AST ANALYSIS')) {
        throw new Error(`AST did not analyze workspace file: ${output}`);
    }
    console.log('  ✓ ast_analyze works on workspace files');
}

async function testGitInWorkspace() {
    console.log('=== Git in Workspace ===');
    const result = await gitStatusTool.invoke({});
    const output = result as string;
    if (!output.includes('Branch:')) {
        throw new Error(`Git not working in workspace: ${output}`);
    }
    console.log('  ✓ git_status works in workspace');
}

async function testLsInWorkspace() {
    console.log('=== LS in Workspace ===');
    const result = await listDirTool.invoke({});
    const output = result as string;
    if (!output.includes(TEST_FILE)) {
        throw new Error(`ls does not show workspace files: ${output}`);
    }
    console.log('  ✓ ls shows workspace files');
}

async function testPathTraversalBlocked() {
    console.log('=== Path Traversal Blocked ===');
    try {
        await readFileTool.invoke({ file_path: '../../package.json' });
        throw new Error('Path traversal not blocked!');
    } catch (e: any) {
        if (e.message.includes('traversal')) {
            console.log('  ✓ Path traversal blocked for read_file');
        } else {
            throw e;
        }
    }
}

async function cleanup() {
    console.log('=== Cleanup ===');
    try {
        const testFiles = [TEST_FILE, 'workspace-test.ts'];
        for (const f of testFiles) {
            const fp = path.join(WORKSPACE_ROOT, f);
            if (fs.existsSync(fp)) fs.unlinkSync(fp);
        }
        console.log('  ✓ Test files cleaned up');
    } catch {}
}

async function runAllTests() {
    console.log('\n=================================');
    console.log('  Workspace Consistency Tests');
    console.log('=================================\n');

    const tests = [
        testWorkspaceRoot,
        testEnsureWorkspace,
        testWriteReadCycle,
        testEditFile,
        testBashSeesWorkspaceFiles,
        testAstAnalyzesWorkspaceFile,
        testGitInWorkspace,
        testLsInWorkspace,
        testPathTraversalBlocked,
        cleanup,
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        try {
            await test();
            passed++;
        } catch (e: any) {
            console.error(`  ✗ ${test.name}: ${e.message}`);
            failed++;
        }
    }

    console.log(`\n  Results: ${passed} passed, ${failed} failed`);
    console.log('=================================\n');

    if (failed > 0) process.exit(1);
}

runAllTests();
