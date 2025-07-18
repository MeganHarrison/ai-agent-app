# Cloudflare Workers Reference

This file contains detailed code examples and patterns for Cloudflare Workers development.

## Code Examples

### Example id="durable_objects_websocket"
Example of using the Hibernatable WebSocket API in Durable Objects to handle WebSocket connections.

```typescript
import { DurableObject } from "cloudflare:workers";

interface Env {
WEBSOCKET_HIBERNATION_SERVER: DurableObject<Env>;
}

// Durable Object
export class WebSocketHibernationServer extends DurableObject {
async fetch(request) {
// Creates two ends of a WebSocket connection.
const webSocketPair = new WebSocketPair();
const [client, server] = Object.values(webSocketPair);

    // Calling `acceptWebSocket()` informs the runtime that this WebSocket is to begin terminating
    // request within the Durable Object. It has the effect of "accepting" the connection,
    // and allowing the WebSocket to send and receive messages.
    // Unlike `ws.accept()`, `state.acceptWebSocket(ws)` informs the Workers Runtime that the WebSocket
    // is "hibernatable", so the runtime does not need to pin this Durable Object to memory while
    // the connection is open. During periods of inactivity, the Durable Object can be evicted
    // from memory, but the WebSocket connection will remain open. If at some later point the
    // WebSocket receives a message, the runtime will recreate the Durable Object
    // (run the `constructor`) and deliver the message to the appropriate handler.
    this.ctx.acceptWebSocket(server);

    return new Response(null, {
          status: 101,
          webSocket: client,
    });

    },

    async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void | Promise<void> {
     // Upon receiving a message from the client, reply with the same message,
     // but will prefix the message with "[Durable Object]: " and return the
     // total number of connections.
     ws.send(
     `[Durable Object] message: ${message}, connections: ${this.ctx.getWebSockets().length}`,
     );
    },

    async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) void | Promise<void> {
     // If the client closes the connection, the runtime will invoke the webSocketClose() handler.
     ws.close(code, "Durable Object is closing WebSocket");
    },

    async webSocketError(ws: WebSocket, error: unknown): void | Promise<void> {
     console.error("WebSocket error:", error);
     ws.close(1011, "WebSocket error");
    }

}
```

```json
{
  "name": "websocket-hibernation-server",
  "durable_objects": {
    "bindings": [
      {
        "name": "WEBSOCKET_HIBERNATION_SERVER",
        "class_name": "WebSocketHibernationServer"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_classes": ["WebSocketHibernationServer"]
    }
  ]
}
```

#### KEY POINTS

- Uses the WebSocket Hibernation API instead of the legacy WebSocket API
- Calls `this.ctx.acceptWebSocket(server)` to accept the WebSocket connection
- Has a `webSocketMessage()` handler that is invoked when a message is received from the client
- Has a `webSocketClose()` handler that is invoked when the WebSocket connection is closed
- Does NOT use the `server.addEventListener` API unless explicitly requested.
- Don't over-use the "Hibernation" term in code or in bindings. It is an implementation detail.

### Example id="durable_objects_alarm_example"
Example of using the Durable Object Alarm API to trigger an alarm and reset it.

```typescript
import { DurableObject } from "cloudflare:workers";

interface Env {
ALARM_EXAMPLE: DurableObject<Env>;
}

export default {
  async fetch(request, env) {
    let url = new URL(request.url);
    let userId = url.searchParams.get("userId") || crypto.randomUUID();
    let id = env.ALARM_EXAMPLE.idFromName(userId);
    return await env.ALARM_EXAMPLE.get(id).fetch(request);
  },
};

const SECONDS = 1000;

export class AlarmExample extends DurableObject {
constructor(ctx, env) {
this.ctx = ctx;
this.storage = ctx.storage;
}
async fetch(request) {
// If there is no alarm currently set, set one for 10 seconds from now
let currentAlarm = await this.storage.getAlarm();
if (currentAlarm == null) {
this.storage.setAlarm(Date.now() + 10 * SECONDS);
}
}
async alarm(alarmInfo) {
// The alarm handler will be invoked whenever an alarm fires.
// You can use this to do work, read from the Storage API, make HTTP calls
// and set future alarms to run using this.storage.setAlarm() from within this handler.
if (alarmInfo?.retryCount != 0) {
console.log(`This alarm event has been attempted ${alarmInfo?.retryCount} times before.`);
}

// Set a new alarm for 10 seconds from now before exiting the handler
this.storage.setAlarm(Date.now() + 10 * SECONDS);
}
}
```

### Example id="kv_session_authentication_example"
Using Workers KV to store session data and authenticate requests, with Hono as the router and middleware.

```typescript
// src/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'

interface Env {
AUTH_TOKENS: KVNamespace;
}

const app = new Hono<{ Bindings: Env }>()

// Add CORS middleware
app.use('*', cors())

app.get('/', async (c) => {
try {
// Get token from header or cookie
const token = c.req.header('Authorization')?.slice(7) ||
c.req.header('Cookie')?.match(/auth_token=([^;]+)/)?.[1];
if (!token) {
return c.json({
authenticated: false,
message: 'No authentication token provided'
}, 403)
}

    // Check token in KV
    const userData = await c.env.AUTH_TOKENS.get(token)

    if (!userData) {
      return c.json({
        authenticated: false,
        message: 'Invalid or expired token'
      }, 403)
    }

    return c.json({
      authenticated: true,
      message: 'Authentication successful',
      data: JSON.parse(userData)
    })

} catch (error) {
console.error('Authentication error:', error)
return c.json({
authenticated: false,
message: 'Internal server error'
}, 500)
}
})

export default app
```

### Example id="queue_producer_consumer_example"
Use Cloudflare Queues to produce and consume messages.

```typescript
// src/producer.ts
interface Env {
  REQUEST_QUEUE: Queue;
  UPSTREAM_API_URL: string;
  UPSTREAM_API_KEY: string;
}

export default {
async fetch(request: Request, env: Env) {
const info = {
timestamp: new Date().toISOString(),
method: request.method,
url: request.url,
headers: Object.fromEntries(request.headers),
};
await env.REQUEST_QUEUE.send(info);

return Response.json({
message: 'Request logged',
requestId: crypto.randomUUID()
});

},

async queue(batch: MessageBatch<any>, env: Env) {
const requests = batch.messages.map(msg => msg.body);

    const response = await fetch(env.UPSTREAM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.UPSTREAM_API_KEY}`
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        batchSize: requests.length,
        requests
      })
    });

    if (!response.ok) {
      throw new Error(`Upstream API error: ${response.status}`);
    }

}
};
```

### Example id="hyperdrive_connect_to_postgres"
Connect to and query a Postgres database using Cloudflare Hyperdrive.

```typescript
// Postgres.js 3.4.5 or later is recommended
import postgres from "postgres";

export interface Env {
// If you set another name in the Wrangler config file as the value for 'binding',
// replace "HYPERDRIVE" with the variable name you defined.
HYPERDRIVE: Hyperdrive;
}

export default {
async fetch(request, env, ctx): Promise<Response> {
console.log(JSON.stringify(env));
// Create a database client that connects to your database via Hyperdrive.
//
// Hyperdrive generates a unique connection string you can pass to
// supported drivers, including node-postgres, Postgres.js, and the many
// ORMs and query builders that use these drivers.
const sql = postgres(env.HYPERDRIVE.connectionString)

    try {
      // Test query
      const results = await sql`SELECT * FROM pg_tables`;

      // Clean up the client, ensuring we don't kill the worker before that is
      // completed.
      ctx.waitUntil(sql.end());

      // Return result rows as JSON
      return Response.json(results);
    } catch (e) {
      console.error(e);
      return Response.json(
        { error: e instanceof Error ? e.message : e },
        { status: 500 },
      );
    }

},
} satisfies ExportedHandler<Env>;
```

### Example id="agents"
Build an AI Agent on Cloudflare Workers, using the agents, and the state management and syncing APIs built into the agents.

```typescript
// src/index.ts
import { Agent, AgentNamespace, Connection, ConnectionContext, getAgentByName, routeAgentRequest, WSMessage } from 'agents';
import { OpenAI } from "openai";

interface Env {
	AIAgent: AgentNamespace<Agent>;
	OPENAI_API_KEY: string;
}

export class AIAgent extends Agent {
	// Handle HTTP requests with your Agent
  async onRequest(request) {
    // Connect with AI capabilities
    const ai = new OpenAI({
      apiKey: this.env.OPENAI_API_KEY,
    });

    // Process and understand
    const response = await ai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: await request.text() }],
    });

    return new Response(response.choices[0].message.content);
  }

  async processTask(task) {
    await this.understand(task);
    await this.act();
    await this.reflect();
  }

	// Handle WebSockets
  async onConnect(connection: Connection) {
   await this.initiate(connection);
   connection.accept()
  }

  async onMessage(connection, message) {
    const understanding = await this.comprehend(message);
    await this.respond(connection, understanding);
  }

  async evolve(newInsight) {
      this.setState({
        ...this.state,
        insights: [...(this.state.insights || []), newInsight],
        understanding: this.state.understanding + 1,
      });
    }

  onStateUpdate(state, source) {
    console.log("Understanding deepened:", {
      newState: state,
      origin: source,
    });
  }

  // Use the this.sql API within the Agent to access the underlying SQLite database
 	async callReasoningModel(prompt: Prompt) {
  	interface Prompt {
   		userId: string;
   		user: string;
   		system: string;
   		metadata: Record<string, string>;
		}

		interface History {
			timestamp: Date;
			entry: string;
		}

		let result = this.sql<History>`SELECT * FROM history WHERE user = ${prompt.userId} ORDER BY timestamp DESC LIMIT 1000`;
		let context = [];
		for await (const row of result) {
			context.push(row.entry);
		}

		const client = new OpenAI({
			apiKey: this.env.OPENAI_API_KEY,
		});

		// Combine user history with the current prompt
		const systemPrompt = prompt.system || 'You are a helpful assistant.';
		const userPrompt = `${prompt.user}\n\nUser history:\n${context.join('\n')}`;

		try {
			const completion = await client.chat.completions.create({
				model: this.env.MODEL || 'o3-mini',
				messages: [
					{ role: 'system', content: systemPrompt },
					{ role: 'user', content: userPrompt },
				],
				temperature: 0.7,
				max_tokens: 1000,
			});

			// Store the response in history
			this
				.sql`INSERT INTO history (timestamp, user, entry) VALUES (${new Date()}, ${prompt.userId}, ${completion.choices[0].message.content})`;

			return completion.choices[0].message.content;
		} catch (error) {
			console.error('Error calling reasoning model:', error);
			throw error;
		}
	}
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		// Routed addressing
		// Automatically routes HTTP requests and/or WebSocket connections to /agents/:agent/:name
		// Best for: connecting React apps directly to Agents using useAgent from @cloudflare/agents/react
		return (await routeAgentRequest(request, env)) || Response.json({ msg: 'no agent here' }, { status: 404 });
	},
} satisfies ExportedHandler<Env>;
```

## API Patterns

### Pattern id="websocket_coordination"
Fan-in/fan-out for WebSockets. Uses the Hibernatable WebSockets API within Durable Objects. Does NOT use the legacy addEventListener API.

```typescript
export class WebSocketHibernationServer extends DurableObject {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Creates two ends of a WebSocket connection.
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Call this to accept the WebSocket connection.
    // Do NOT call server.accept() (this is the legacy approach and is not preferred)
    this.ctx.acceptWebSocket(server);

    return new Response(null, {
          status: 101,
          webSocket: client,
    });
},

async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void | Promise<void> {
  // Invoked on each WebSocket message.
  ws.send(message)
},

async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) void | Promise<void> {
  // Invoked when a client closes the connection.
  ws.close(code, "<message>");
},

async webSocketError(ws: WebSocket, error: unknown): void | Promise<void> {
  // Handle WebSocket errors
}
}
```