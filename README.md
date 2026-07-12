# CodeCraft AI

Autonomous AI coding agent system with memory, RAG, and multi-agent orchestration.

## Quick Start

```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 3. Run the CLI agent
npm run agent

# 4. Or start the HTTP server
npm run dev
```

## Architecture

```
src/
├── config/              # Environment config & paths
├── utils/               # Logger & helpers
├── llm/                 # LLM singleton (Cohere)
├── tools/               # 27+ tools across 10 categories
│   ├── bash.ts          # Shell execution
│   ├── fileSystem.ts    # File read/write/edit
│   ├── git.ts           # Git diff/log/status
│   ├── ast.ts           # AST code analysis
│   ├── importGraph.ts   # Import dependency graph
│   ├── rag.ts           # RAG embed/query
│   ├── todo.ts          # Task management
│   ├── chat-history/    # Chat history persistence
│   └── task/            # Sub-agent spawning
├── agent/               # Standalone CLI agent
├── coder-agent/         # Code generation agent
├── memory-agent/        # Memory system (STM + LTM)
├── tool-selector-agent/ # Dynamic tool selection
├── multi-agent/         # StateGraph orchestrator
├── rag/                 # RAG pipeline
│   ├── chunker.ts       # AST-aware code chunking
│   ├── embedding.ts     # Cohere embeddings → Pinecone
│   ├── retrieval.ts     # Multi-vector retrieval
│   └── pinecone-config.ts
├── middleware/           # Tool monitoring
└── app/                 # Express HTTP layer
    ├── bootstrap/       # Server setup
    ├── http/            # Controllers & routes
    ├── models/          # Mongoose schemas
    └── services/        # Business logic
```

## Tools (27 total)

| Category | Tools |
|----------|-------|
| **filesystem** | read_file, write_file, edit_file, file_tree, ls, search_file |
| **bash** | bash (shell execution) |
| **graph** | build_import_graph, query_import_graph, impact_analysis |
| **memory** | read_agent_index, update_agent_index, read/write/list_agent_modules, read_embeddings_index |
| **rag** | embed_codebase, query_codebase |
| **ast** | ast_analyze |
| **git** | git_diff, git_log, git_status |
| **todo** | write_todos, read_todos, update_todos, get_next_runnable_tasks |
| **task** | task (sub-agent spawning) |
| **think** | think_tool (strategic reflection) |

## Agents

### CLI Agent (`npm run agent`)
Standalone ReAct agent with all tools. Interactive terminal session.

### Multi-Agent System (HTTP)
Three-node StateGraph:
1. **Memory Agent** - Manages STM/LTM, retrieves context
2. **Coder Agent** - Executes code tasks with tools
3. **Tool Selector** - Dynamically activates tool categories

### Memory System
- **STM**: Daily logs per user (auto-compressed when too long)
- **LTM**: Persistent memory files (MEMORY-{userId}.md)
- **Context Builder**: Assembles system + profile + STM context

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat/stream` | SSE streaming chat |
| GET | `/api/chat/history` | Retrieve chat history |
| POST | `/upload-zip` | Upload project ZIP |
| GET | `/api/health` | Health check |

## Testing

```bash
npm run test:registry   # Tool registry validation
npm run test:tools      # Core tool tests
npm run test:memory     # Memory agent tests
npm run test:agents     # Agent integration tests
npm run test:all        # All tests
npm run typecheck       # TypeScript compilation check
```

## Environment Variables

See `.env.example` for all required/optional variables.

Required:
- `COHERE_API_KEY` - Cohere API key for LLM + embeddings

Optional:
- `PINECONE_API_KEY` - For RAG vector storage
- `DB_URL` - MongoDB for session persistence
- `GITHUB_CLIENT_ID/SECRET` - GitHub OAuth
