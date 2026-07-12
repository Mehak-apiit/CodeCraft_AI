import { loadAllTools, listAllToolNames, listToolCategories, loadToolCategory } from '../src/tools/toolRegistry';

async function testToolRegistry() {
    console.log('=== Tool Registry Tests ===');

    const categories = listToolCategories();
    console.log(`✓ Categories: ${categories.length} (${categories.join(', ')})`);

    const toolNames = listAllToolNames();
    console.log(`✓ Tool names: ${toolNames.length}`);

    const allTools = loadAllTools();
    console.log(`✓ Loaded tools: ${allTools.length}`);

    for (const cat of categories) {
        const catTools = loadToolCategory(cat);
        console.log(`  - ${cat}: ${catTools.length} tools`);
    }

    console.log('=== All Registry Tests Passed ===\n');
}

testToolRegistry().catch(console.error);
