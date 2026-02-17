# Agent Instructions

## Project Overview

Wordpan is a full-stack AI-powered web application template demonstrating modern AI agent integration with CrewAI, Supabase, and comprehensive observability using Arize Phoenix.

### Architecture
- **Frontend**: React 19.1 + TypeScript 5.9 + Vite 7 + Tailwind CSS 4
- **AI Backend**: Python 3.13 + Flask + CrewAI 0.201 + LiteLLM
- **Database**: PostgreSQL via Supabase with Row-Level Security (RLS)
- **Observability**: Arize Phoenix 12.4.0 with OpenTelemetry tracing
- **Containerization**: Docker Compose with hot reload

## Database Operations

**CRITICAL: Never run database migration commands in this project.**

When working with Supabase migrations:
- Use `supabase migration new <name>` to create new migration files only
- **DO NOT** run `supabase db reset` - it will wipe all data
- **DO NOT** run `supabase db reset` - it wipes all data
- **DO NOT** run `supabase db push` - that is for remote (linked) projects only

For local: the developer (or `scripts/setup-and-verify.ps1`) may run `supabase migration up` to apply new migrations without wiping data.

## Development Guidelines

### Request Flow (AI Phrase Generation)
1. User clicks "Generate Phrase" → Frontend fetches 3 random words from Supabase
2. Frontend sends words + JWT token to AI backend `/api/random-phrase`
3. Backend validates JWT with Supabase
4. Backend fetches user profile/context from Supabase
5. CrewAI crew executes with user context
6. All AI operations traced via OpenTelemetry → Phoenix
7. Backend returns generated phrase + words
8. Frontend displays result

### Request Flow (Language Tutor Chat)
1. User opens **Chat** (sidebar). Chats and messages are stored in Supabase (`chats`, `chat_messages`).
2. User sends a message → Frontend appends to messages, calls `/api/chat` with JWT, `message`, and `history`.
3. Backend validates JWT, optionally checks chat ownership, then runs the **router** crew to classify intent: `translation`, `new_word`, `general_tutor`, or `off_topic`.
4. Backend runs the matching specialist: translation crew, vocabulary crew (returns a word card), or general tutor crew. Off-topic gets a polite refusal.
5. Response: either `{ "content": "..." }` or `{ "response_type": "word_card", "payload": { "word", "translation", "example_sentence", "definition" } }`.
6. Frontend shows the reply; for word cards it renders a card with **"Add to my list"**. On click, the frontend inserts into `word_pairs` via the Supabase client (user JWT). Optional backend endpoint `/api/chat/save-word` exists for server-side save (requires `SUPABASE_SERVICE_ROLE_KEY`).
7. All AI calls are traced to Phoenix. Chat UI includes a **Help** button with a short guide and example prompts.

### Authentication Flow
- Supabase Auth with JWT tokens
- Profile auto-created via database trigger on signup
- Backend validates JWT before processing requests
- RLS policies enforce data access control

### Adding New CrewAI Crews

1. Create crew directory structure:
   ```bash
   mkdir -p ai/src/crews/my_new_crew/config
   ```

2. Define agents in `agents.yaml`:
   ```yaml
   my_agent:
     role: "Agent Role"
     goal: "What the agent should achieve"
     backstory: "Agent's background and expertise"
     model: "groq/llama-3.3-70b-versatile"
   ```

3. Define tasks in `tasks.yaml`:
   ```yaml
   my_task:
     description: "Task description with {variable}"
     expected_output: "Expected output format"
     agent: my_agent
   ```

4. Create crew class in `crew.py`:
   ```python
   from crewai import Agent, Crew, Task, Process

   class MyNewCrew:
       def __init__(self):
           # Load configs, initialize agents and tasks
           pass

       def run(self, inputs: dict):
           crew = Crew(
               agents=[self.agent],
               tasks=[self.task],
               process=Process.sequential
           )
           return crew.kickoff(inputs=inputs)
   ```

5. Add endpoint in `ai/run.py`:
   ```python
   @app.route('/api/my-endpoint', methods=['POST'])
   async def my_endpoint():
       # Initialize crew, run, return result
       pass
   ```

### Environment Configuration

**Frontend** (`web/.env.local`):
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `VITE_AI_SERVICE_URL` - AI backend base URL

**Backend** (`ai/.env`):
- `GROQ_API_KEY` (or `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) - LLM provider key
- `PHOENIX_PROJECT_NAME` - Project name in Phoenix
- `PHOENIX_COLLECTOR_ENDPOINT` - Phoenix OTLP endpoint
- `SUPABASE_URL` - Supabase URL (use `http://host.docker.internal:54321` in Docker)
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` (optional) - For server-side writes (e.g. `/api/chat/save-word`); chat "Add to my list" uses frontend Supabase client without this

**Phoenix** (`phoenix/.env`):
- `POSTGRES_HOST`, `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_PASSWORD`
- `PHOENIX_SQL_DATABASE_URL` - Phoenix database connection string

## Common Tasks

### Running Services
```bash
# All services
docker compose up --build

# Individual services
cd web && npm run dev
cd ai && uv run python run.py
supabase start
docker compose up phoenix phoenix-db
```

### Database Operations
```bash
# Create migration (ONLY command allowed)
supabase migration new <descriptive_name>

# Apply migrations locally (no data wipe; use this, not db reset)
supabase migration up

# Access database
supabase db psql

# Open Supabase Studio
open http://127.0.0.1:54323
```

### One-command setup and verify (local)
From repo root:
```powershell
.\scripts\setup-and-verify.ps1
```
Starts Supabase (if needed), runs `supabase migration up`, brings up Docker Compose, and checks health of AI and web.

### Debugging
- **Frontend**: React DevTools, Vite terminal logs, Network tab
- **Backend**: debugpy on port 5678 (VS Code launch config in `.vscode/launch.json`)
- **AI Observability**: Phoenix UI at http://localhost:6006
- **Database**: Supabase Studio at http://127.0.0.1:54323

## Important Constraints

1. **Database Migrations**: Never run `supabase db reset` or `supabase db push`
2. **RLS Policies**: All database tables use Row-Level Security
3. **JWT Validation**: Backend must validate tokens before processing
4. **OpenTelemetry**: All AI operations must be traced
5. **User Context**: AI crews should incorporate user profile data
6. **LiteLLM**: Use LiteLLM for LLM provider abstraction
7. **Hot Reload**: Docker setup supports hot reload for development

## Security Notes

- Database has Row-Level Security (RLS) - users can only access their own data
- JWT tokens stored in Supabase client (localStorage)
- Backend validates all tokens with Supabase before processing
- Auto-created profiles via database triggers
