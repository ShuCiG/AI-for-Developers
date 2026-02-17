# Wordpan Template

### What is This Template For?

This template serves two primary purposes:

1. **Learning Resource**: Understand how to architect and implement AI-powered features in modern web applications with proper observability and security
2. **Project Starter**: Use as a foundation for building your own AI-enhanced applications with a proven tech stack

## Tech Stack

### Frontend
- **Framework**: React 19.1 with React Router 7
- **Language**: TypeScript 5.9
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS 4 with Radix UI components
- **UI Libraries**: Tabler Icons, Lucide React, Recharts
- **State Management**: React Context for user state
- **HTTP Client**: Supabase JS SDK 2.75

### Backend (AI Services)
- **Language**: Python 3.13
- **Framework**: Flask with async support
- **AI Orchestration**: CrewAI 0.201
- **LLM Integration**: LiteLLM (supports multiple providers)
- **Database Client**: Supabase Python SDK 2.22
- **Package Manager**: UV (fast Python package installer)

### Infrastructure & Observability
- **Database**: PostgreSQL 16.4 (via Supabase)
- **Authentication**: Supabase Auth
- **Containerization**: Docker & Docker Compose
- **AI Observability**: Arize Phoenix 12.4.0
- **Tracing**: OpenTelemetry with OTLP exporters
- **Instrumentation**: OpenInference for CrewAI and LiteLLM

## Prerequisites

Before you begin, ensure you have the following installed:

### Required
- **Docker**: 20.10+ and Docker Compose 2.0+
- **Node.js**: 20+ (for local development without Docker)
- **Python**: 3.13+ (for local development without Docker)
- **Supabase CLI**: Latest version
  ```bash
  brew install supabase/tap/supabase  # macOS
  # or visit https://supabase.com/docs/guides/cli
  ```

### Optional (for local development)
- **UV**: Fast Python package installer
  ```bash
  curl -LsSf https://astral.sh/uv/install.sh | sh
  ```
- **Git**: For version control
- **Your favorite code editor**: VS Code, Cursor, etc.

### API Keys
- **LLM Provider API Key**: Currently configured for Groq (free tier available), but supports any LiteLLM-compatible provider (OpenAI, Anthropic, etc.)

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd wordpan-template
```

### 2. Set Up Environment Variables

Create environment files for each service:

#### Web Frontend (`web/.env.local`)
```bash
cp web/.env.example web/.env.local
```

#### AI Backend (`ai/.env`)
```bash
cp ai/.env.example ai/.env
```

#### Phoenix Observability (`phoenix/.env`)
```bash
cp phoenix/.env.example phoenix/.env
```

### 3. Start Supabase

Start the local Supabase instance:

```bash
# Start Supabase
supabase start
```

This will output your local Supabase credentials, including:
- API URL (typically `http://127.0.0.1:54321`)
- `Publishable key` (use this for `VITE_SUPABASE_ANON_KEY` and `SUPABASE_ANON_KEY`)
- `Secret key` (use this for `SUPABASE_SERVICE_ROLE_KEY`)

**⚠️ IMPORTANT**: Update both `web/.env.local` and `ai/.env` files.

### 4. Create clean database and apply migrations

```bash
# Create the database schema
supabase db reset
```

**Note**: This is safe on first setup. For ongoing development, see the [Database Migration Guidelines](#database-migration-guidelines) section.

### 5. Start the Application

#### Option 1: Quick Start (Recommended)

Use the provided startup script:

**Windows (PowerShell):**
```powershell
.\start.ps1
```

**Linux/macOS:**
```bash
chmod +x start.sh
./start.sh
```

This script will:
- Start Supabase locally
- Start all Docker services
- Wait for services to be ready
- Display service URLs

#### Option 2: Manual Start

Start Supabase first:
```bash
supabase start
```

Then start Docker services:
```bash
docker compose up -d
```

This will start:
- **Web Frontend**: http://localhost:5173
- **AI Backend**: http://localhost:8000
- **Phoenix Observability**: http://localhost:6006
- **Supabase Studio**: http://127.0.0.1:54323
- **Phoenix Database**: Internal PostgreSQL instance

### 6. Stop the Application

**Windows (PowerShell):**
```powershell
.\stop.ps1
```

**Linux/macOS:**
```bash
./stop.sh
```

Or manually:
```bash
docker compose down
supabase stop
```

### 7. Access the Application

1. **Web App**: Open http://localhost:5173
2. **Sign Up**: Create a new account via the signup page
3. **Generate Phrases**: Navigate to the "Random Phrase" page to see AI in action
4. **Language Tutor Chat**: Open **Chat** from the sidebar. Ask for translations, new vocabulary, or grammar help. When the assistant shows a word card, use **"Add to my list"** to save the word pair to your **Word Pairs** list. Use the **Help** button next to the input for a short guide and example prompts.
5. **Word Pairs**: View and manage your saved word pairs (including those added from chat) on the **Word Pairs** page
6. **Monitor AI**: Open http://localhost:6006 to view AI traces and metrics in Phoenix

### 8. Verify Everything Works

Test the AI endpoint:
```bash
curl http://localhost:8000/health
# Should return: {"status": "healthy"}
```

## Development

### Running Services Individually

#### Frontend Only
```bash
cd web
npm install
npm run dev
```

#### AI Backend Only
```bash
cd ai
uv sync
uv run python run.py
```

#### Supabase Only
```bash
supabase start
```

#### Phoenix Only
```bash
docker compose up phoenix phoenix-db
```

### Database Migration Guidelines

**⚠️ CRITICAL**: This project has strict database migration rules to prevent data loss.

#### Creating New Migrations

```bash
# Create a new migration file
supabase migration new <descriptive_name>

# Edit the generated file in supabase/migrations/
# Add your SQL changes
```

#### Applying Migrations

**DO NOT RUN THESE COMMANDS** (they will wipe data):
- ❌ `supabase db reset`
- ❌ `supabase db push`

**Instead, apply migrations manually**:

For local development:
```bash
supabase migration up
```

### Debugging

#### Frontend Debugging
- React DevTools in browser
- Vite dev server shows errors in terminal
- Check Network tab for API calls

#### Backend Debugging
The AI service runs with `debugpy` on port 5678. A VS Code launch configuration is provided in `.vscode/launch.json` - just press F5 or use the "Run and Debug" panel to attach to the running container.

#### Database Debugging
```bash
# Access Supabase Studio
open http://127.0.0.1:54323

# Direct database access
supabase db psql
```

#### AI Observability
Open Phoenix at http://localhost:6006 to:
- View all AI agent traces
- Analyze LLM call latency and tokens
- Debug agent reasoning and outputs
- Track session performance

## License

[MIT License](LICENSE) - feel free to use this template for any project.

## Acknowledgments

This template is built with amazing open-source technologies:

- [React](https://reactjs.org/) - UI framework
- [Vite](https://vitejs.dev/) - Build tool
- [CrewAI](https://www.crewai.com/) - Multi-agent orchestration
- [Supabase](https://supabase.com/) - Backend-as-a-Service
- [Arize Phoenix](https://phoenix.arize.com/) - AI observability
- [Tailwind CSS](https://tailwindcss.com/) - Styling framework
- [Radix UI](https://www.radix-ui.com/) - Accessible components
- [Flask](https://flask.palletsprojects.com/) - Python web framework
- [LiteLLM](https://github.com/BerriAI/litellm) - LLM API abstraction
- [Docker](https://www.docker.com/) - Containerization

---

**Built with ❤️ for developers building AI-powered applications**

For questions or feedback, please open an issue or discussion.
