import { write_todos, read_todos } from './src/tools/todo';

async function main() {
  console.log('=== write_todos ===');
  const write = await write_todos.invoke({
    filename: 'test',
    todos: [
      { task: 'test1', assigned_to: 'agent' },
      { task: 'test2', assigned_to: 'agent' },
    ],
  });
  console.log(write);

  console.log('\n=== read_todos ===');
  const read = await read_todos.invoke({ filename: 'test' });
  console.log(read);

  process.exit(0);
}

main();
