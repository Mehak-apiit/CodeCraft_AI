import 'dotenv/config';
import { createMemoryAgent } from '../src/memory-agent';
import { LLM } from '../src/llm/llm';

async function testMemoryAgentCreation() {
    console.log('=== Memory Agent Creation Test ===');
    const llm = LLM.getInstance('cohere');
    console.log(`✓ LLM instance: ${llm.constructor.name}`);

    const agent = await createMemoryAgent({
        model: llm,
        userId: 'test-user',
        projectId: 'test-project',
    });
    console.log(`✓ Memory agent created`);
    console.log(`✓ Methods: ${Object.keys(agent).join(', ')}`);
    return agent;
}

async function testMemoryAgentInvoke(agent: any) {
    console.log('=== Memory Agent Invoke Test ===');
    try {
        const response = await agent.invokeMemoryAgent('Hello, this is a test');
        console.log(`✓ Response: ${(response as string).slice(0, 100)}`);
    } catch (err: any) {
        console.log(`  Invoke (expected if no API): ${err.message?.slice(0, 80)}`);
    }
}

async function runTests() {
    console.log('\n============================');
    console.log('  Memory Agent Tests');
    console.log('============================\n');

    try {
        const agent = await testMemoryAgentCreation();
        await testMemoryAgentInvoke(agent);
    } catch (e: any) {
        console.error('✗ Test failed:', e.message);
    }

    console.log('\n============================');
    console.log('  Memory Agent Tests Complete');
    console.log('============================\n');
}

runTests();
