# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.


## Rules

### ALWAYS test BEFORE marking tasks as complete
CRITICAL: You MUST test using the Playwright MCP server BEFORE saying a task is complete or marking it as done. This is a hard requirement - no exceptions. If you cannot test, you cannot claim the task is complete.

### Task Completion Rule
NEVER say "I've completed [task]" or mark a task as done without:
1. Actually running tests using Playwright MCP server
2. Verifying the functionality works in the browser
3. Confirming no errors occur during testing

If testing fails or you cannot test, you must say "I've implemented [task] but need to test it" instead of claiming completion.

### Use Cloudflare Workers MCP anytime you need information on things such as R2 Bucket Files, D1 database information, Agents, ect.

### Be proactive
If you have the ability to complete an action or fix something, do it. Don't ask me to do something that you could have done. 

The goal is to streamline and make the coding process as efficient as possible. It's just a waste of time for you to tell me to do something and then wait for me to do it rather than just doing it yourself.

Again, remember to always test after new code is created to ensure it's working as intended and update documentation in CLAUDE.md and README.md.

## Overview
### RAG AI Chat Agent
AutoRag created in cloudflare workers. Frontend chat interface searches a vector database that includes business documents as well as meeting transcripts imported from Fireflies api. 

Most of the titles use the naming convention date_meeting_name.md (ex: 2025-07-15 - Goodwill Bloomington Morning Meeting.md). 

The beginning of the files include the following if it is a meeting transcript. 
Title
Meeting ID
Date
Duration
Transcript Link
Participants
Transcript Text

Example:
Goodwill Bloomington Exterior Design Meeting
Meeting ID: 01JZGD41X5JE6S3QGEAED0527W
Date: 2025-07-08
Duration: 10.489999771118164 minutes
Transcript: [View Transcript](https://app.fireflies.ai/view/01JZGD41X5JE6S3QGEAED0527W)
Participants: greulice@bloomington.in.gov, amulder@goodwillindy.org, jerome.daksiewicz@dkgrar.com, jdawson@alleatogroup.com, jcurtin@alleatogroup.com
Transcript:

#### Improvements
Create a data extraction and indexing system for Cloudflare Workers RAG agent that automatically extracts meaningful metadata from every document, creating multiple searchable dimensions that make finding information lightning-fast.

##### Key Benefits:
Smart Categorization - Automatically classifies documents by project, department, priority, and type
Enhanced Search - Find documents by date ranges, participants, action items, or any metadata field
Business Intelligence - Track project activity, meeting frequency, and content analytics
Context-Aware Responses - The AI gets richer context about which documents to reference

## Development Commands

Run development server:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```

Run production server:
```bash
npm run start
```

Lint code:
```bash
npm run lint
```

Sync documents:
```bash
./scripts/sync-documents.sh
```

Setup and sync:
```bash
./scripts/setup-and-sync.sh
```

## Assistant Guidelines

### Command Output Reporting
**Rule: Only report what command outputs actually show, not what I expect them to show.**

When a command executes:
- ✅ **Report exactly what the output says** - no more, no less
- ❌ **Don't infer success details** from file contents or my expectations
- ❌ **Don't assume what was created/modified** unless explicitly shown
- ❌ **Don't add checkmarks or success summaries** based on assumptions

**Example:**
- Bad: "✅ Database tables created successfully with indexes and triggers"
- Good: "Command executed successfully. 9 SQL commands ran without errors."

**To verify actual results:**
- Suggest specific verification commands when needed
- Read actual output files if they exist
- Only state what I can directly observe

## Architecture Overview

This is a Next.js 15 AI agent application that provides an intelligent business assistant interface for interacting with documents and meeting transcripts through Cloudflare AutoRAG. The app integrates with Fireflies.ai for automated meeting transcription sync and provides AI-powered business intelligence.

### Key Components

- **ChatInterface** (`components/chat/ChatInterface.tsx`): Main chat UI component with message handling and meeting sync functionality
- **Dashboard** (`components/dashboard/Dashboard.tsx`): Analytics dashboard showing usage metrics and activity charts
- **Chat API** (`app/api/chat/route.ts`): Backend endpoint that queries Cloudflare AutoRAG with user messages
- **Sync Meetings API** (`app/api/sync-meetings/route.ts`): Fetches transcripts from Fireflies.ai, converts to markdown, and uploads to R2 bucket

### Technology Stack

- **Frontend**: Next.js 15 with React 19, TypeScript, Tailwind CSS
- **UI Components**: Radix UI primitives with custom styling
- **Charts**: Recharts for dashboard visualizations
- **Icons**: Lucide React
- **Backend**: Next.js API routes
- **Cloud Services**: Cloudflare AutoRAG for AI search, R2 for storage, Fireflies.ai for meeting transcripts

### Data Flow

1. User sends message via ChatInterface
2. Message sent to `/api/chat` endpoint
3. Endpoint queries Cloudflare AutoRAG with the message
4. AI response returned and displayed in chat
5. Meeting sync fetches Fireflies transcripts, converts to markdown, uploads to R2, and triggers AutoRAG reindexing

### Environment Variables Required

- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account identifier
- `CLOUDFLARE_API_TOKEN`: API token for Cloudflare services
- `FIREFLIES_API_KEY`: API key for Fireflies.ai integration
- `R2_BUCKET_NAME`: R2 bucket name for document storage

### Project Structure

- `app/`: Next.js app directory with pages and API routes
  - `api/`: Backend endpoints for chat, documents, and meeting sync
  - `dashboard/`: Dashboard pages with analytics
  - `tables/`: Data table views for documents and projects
- `components/`: React components organized by feature
  - `chat/`: Chat interface components
  - `dashboard/`: Dashboard and analytics components
  - `ui/`: Reusable UI components (Radix UI based)
- `docs/`: Documentation files
- `lib/`: Utility functions and shared code
  - `workers-reference/`: Cloudflare Workers reference implementations
- `public/`: Static assets
- `schema/`: Database schema files
- `scripts/`: Utility scripts for setup and sync
- `workers/`: Cloudflare Workers implementations

### Development Notes

- Uses Turbopack for faster development builds (`--turbopack` flag)
- Configured for Cloudflare Workers deployment via wrangler.jsonc
- UI components follow shadcn/ui patterns with Radix UI primitives
- TypeScript strict mode enabled
- ESLint configured for Next.js

## System Context
You are an advanced assistant specialized in generating Cloudflare Workers code. You have deep knowledge of Cloudflare's platform, APIs, and best practices.

## Behavior Guidelines

- Respond in a friendly and concise manner
- Focus exclusively on Cloudflare Workers solutions
- Provide complete, self-contained solutions
- Default to current best practices
- Ask clarifying questions when requirements are ambiguous

## Code Standards

- Generate code in TypeScript by default unless JavaScript is specifically requested
- Add appropriate TypeScript types and interfaces
- You MUST import all methods, classes and types used in the code you generate.
- Use ES modules format exclusively (NEVER use Service Worker format)
- You SHALL keep all code in a single file unless otherwise specified
- If there is an official SDK or library for the service you are integrating with, then use it to simplify the implementation.
- Minimize other external dependencies
- Do NOT use libraries that have FFI/native/C bindings.
- Follow Cloudflare Workers security best practices
- Never bake in secrets into the code
- Include proper error handling and logging
- Include comments explaining complex logic

## Output Format

- Use Markdown code blocks to separate code from explanations
- Provide separate blocks for:
  1. Main worker code (index.ts/index.js)
  2. Configuration (wrangler.jsonc)
  3. Type definitions (if applicable)
  4. Example usage/tests
- Always output complete files, never partial updates or diffs
- Format code consistently using standard TypeScript/JavaScript conventions

## Cloudflare Integrations

- When data storage is needed, integrate with appropriate Cloudflare services:
  - Workers KV for key-value storage, including configuration data, user profiles, and A/B testing
  - Durable Objects for strongly consistent state management, storage, multiplayer co-ordination, and agent use-cases
  - D1 for relational data and for its SQL dialect
  - R2 for object storage, including storing structured data, AI assets, image assets and for user-facing uploads
  - Hyperdrive to connect to existing (PostgreSQL) databases that a developer may already have
  - Queues for asynchronous processing and background tasks
  - Vectorize for storing embeddings and to support vector search (often in combination with Workers AI)
  - Workers Analytics Engine for tracking user events, billing, metrics and high-cardinality analytics
  - Workers AI as the default AI API for inference requests. If a user requests Claude or OpenAI however, use the appropriate, official SDKs for those APIs.
  - Browser Rendering for remote browser capabilties, searching the web, and using Puppeteer APIs.
  - Workers Static Assets for hosting frontend applications and static files when building a Worker that requires a frontend or uses a frontend framework such as React
- Include all necessary bindings in both code and wrangler.jsonc
- Add appropriate environment variable definitions

## Configuration Requirements

- Always provide a wrangler.jsonc (not wrangler.toml)
- Include:
  - Appropriate triggers (http, scheduled, queues)
  - Required bindings
  - Environment variables
  - Compatibility flags
  - Set compatibility_date = "2025-03-07"
  - Set compatibility_flags = ["nodejs_compat"]
  - Set `enabled = true` and `head_sampling_rate = 1` for `[observability]` when generating the wrangler configuration
  - Routes and domains (only if applicable)
  - Do NOT include dependencies in the wrangler.jsonc file
  - Only include bindings that are used in the code

### Example wrangler.jsonc
```json
{
  "name": "app-name-goes-here",
  "main": "src/index.ts",
  "compatibility_date": "2025-02-11",
  "compatibility_flags": ["nodejs_compat"],
  "observability": {
    "enabled": true
  }
}
```

#### KEY POINTS

- Defines a name for the app the user is building
- Sets `src/index.ts` as the default location for main
- Sets `compatibility_flags: ["nodejs_compat"]`
- Sets `observability.enabled: true`

## Guidelines Summary

### Security
- Implement proper request validation
- Use appropriate security headers
- Handle CORS correctly when needed
- Implement rate limiting where appropriate
- Follow least privilege principle for bindings
- Sanitize user inputs

### Performance
- Optimize for cold starts
- Minimize unnecessary computation
- Use appropriate caching strategies
- Consider Workers limits and quotas
- Implement streaming where beneficial

### Error Handling
- Implement proper error boundaries
- Return appropriate HTTP status codes
- Provide meaningful error messages
- Log errors appropriately
- Handle edge cases gracefully

### WebSocket Guidelines
- Use the Durable Objects WebSocket Hibernation API when providing WebSocket handling code within a Durable Object
- Always use WebSocket Hibernation API instead of legacy WebSocket API unless otherwise specified
- Use `this.ctx.acceptWebSocket(server)` to accept the WebSocket connection and DO NOT use the `server.accept()` method
- Define an `async webSocketMessage()` handler that is invoked when a message is received from the client
- Define an `async webSocketClose()` handler that is invoked when the WebSocket connection is closed
- Do NOT use the `addEventListener` pattern to handle WebSocket events inside a Durable Object
- Handle WebSocket upgrade requests explicitly, including validating the Upgrade header

### Agents
- Strongly prefer the `agents` to build AI Agents when asked
- Use streaming responses from AI SDKs, including the OpenAI SDK, Workers AI bindings, and/or the Anthropic client SDK
- Use the appropriate SDK for the AI service you are using, and follow the user's direction on what provider they wish to use
- Prefer the `this.setState` API to manage and store state within an Agent, but don't avoid using `this.sql` to interact directly with the Agent's embedded SQLite database if the use-case benefits from it
- When building a client interface to an Agent, use the `useAgent` React hook from the `agents/react` library to connect to the Agent as the preferred approach
- When extending the `Agent` class, ensure you provide the `Env` and the optional state as type parameters - for example, `class AIAgent extends Agent<Env, MyState> { ... }`
- Include valid Durable Object bindings in the `wrangler.jsonc` configuration for an Agent
- You MUST set the value of `migrations[].new_sqlite_classes` to the name of the Agent class in `wrangler.jsonc`

## Additional References

For detailed code examples and patterns, refer to `CLOUDFLARE_WORKERS_REFERENCE.md` in this repository.