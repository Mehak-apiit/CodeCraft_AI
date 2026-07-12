import 'dotenv/config';
import { LLM } from '../src/llm/llm';

console.log('\n=== LLM Factory Test ===');
const cohere = LLM.getInstance('cohere');
console.log('cohere:', cohere.constructor.name);
const fast = LLM.getInstance('cohere-fast');
console.log('cohere-fast:', fast.constructor.name);
console.log('\n=== All Tests Complete ===');
process.exit(0);
