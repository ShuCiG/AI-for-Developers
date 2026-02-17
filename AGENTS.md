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
- **DO NOT** run `supabase db push` - migrations should be applied manually by the developer

Only create migration files. Let the developer apply them manually.

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

### Container Verification After Changes

**CRITICAL: After making changes to any service, always verify containers are running without errors.**

After modifying code in any service (frontend, backend, database migrations, etc.):

1. **Check container status**:
   ```bash
   docker compose ps
   ```
   All containers should show `(healthy)` or at least `Up` status. Containers in `(health: starting)` status may need more time (up to 2 minutes for `ai` service).

2. **Check logs for errors** (focus on modified services):
   ```bash
   # Check specific service logs
   docker compose logs <service_name> --tail 50
   
   # Examples:
   docker compose logs ai --tail 50
   docker compose logs web --tail 50
   ```

3. **Restart affected containers** if needed:
   ```bash
   # Restart specific service
   docker compose restart <service_name>
   
   # Or recreate to pick up environment variable changes
   docker compose up -d --force-recreate <service_name>
   ```

4. **Verify health endpoints**:
   ```bash
   # AI service health check
   curl http://localhost:8000/health
   
   # Web service (should return HTML)
   curl http://localhost:5173
   ```

5. **Common issues to check**:
   - Environment variables not loaded → Use `--force-recreate` instead of `restart`
   - Import errors → Check logs for `ModuleNotFoundError` or `ImportError`
   - Port conflicts → Check if ports are already in use
   - Health check failures → Review logs for startup errors

**Best Practice**: After any code changes, always verify the affected container(s) are running correctly before marking tasks as complete.

### Database Operations
```bash
# Create migration (ONLY command allowed)
supabase migration new <descriptive_name>

# Access database
supabase db psql

# Open Supabase Studio
open http://127.0.0.1:54323
```

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
