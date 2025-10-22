# Dynamic MCP Server

A dynamic Model Context Protocol (MCP) server that allows you to add and remove API endpoints at runtime, exposing them as tools to LLM clients like Claude.

## Features

- 🔄 **Dynamic Tool Registration**: Add/remove API endpoints on the fly
- 🌐 **HTTP REST API**: Manage endpoints via simple HTTP calls
- 🔌 **MCP Protocol**: Full MCP server implementation via Streamable HTTP
- 📡 **Real-time Updates**: Clients are automatically notified when tools change
- 🛠️ **Type Safe**: Built with TypeScript for type safety
- 💰 **Real-Time Blockchain Payments**: Instant ETH payments on Base with transaction confirmation
- 👥 **Multi-User Architecture**: Developers create tools, end users pay for usage
- 🔐 **User Authentication**: Secure JWT-based authentication with Supabase
- ⛓️ **On-Chain Verification**: All payments recorded on Base blockchain with tx hashes

## Quick Start

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

### Configuration

Create a `.env` file:

```env
PORT=8080
HOST=0.0.0.0
ENDPOINTS_FILE=endpoints.json  # Optional: Load endpoints from file on startup
```

### Pre-loading Endpoints

You can optionally create an `endpoints.json` file to pre-load endpoints on server startup:

```json
[
  {
    "name": "get_user",
    "url": "https://api.example.com/users/{id}",
    "method": "GET",
    "description": "Get user by ID",
    "parameters": [
      {
        "name": "id",
        "type": "string",
        "description": "User ID",
        "required": true
      }
    ]
  }
]
```

See `endpoints.example.json` for more examples.

## Usage

### Starting the Server

```bash
npm run dev
```

The server will start with no initial endpoints. You can add them dynamically via the REST API.

### Adding an Endpoint

```bash
curl -X POST http://localhost:8080/api/endpoints \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get_user",
    "url": "https://api.example.com/users/{id}",
    "method": "GET",
    "description": "Get user by ID",
    "parameters": [
      {
        "name": "id",
        "type": "string",
        "description": "User ID",
        "required": true
      }
    ]
  }'
```

### Listing Endpoints

```bash
curl http://localhost:8080/api/endpoints
```

### Removing an Endpoint

```bash
curl -X DELETE http://localhost:8080/api/endpoints/get_user
```

### Health Check

```bash
curl http://localhost:8080/health
```

## API Reference

### REST API Endpoints

| Method | Path                    | Description                   |
| ------ | ----------------------- | ----------------------------- |
| POST   | `/api/endpoints`        | Add a new API endpoint        |
| GET    | `/api/endpoints`        | List all configured endpoints |
| DELETE | `/api/endpoints/{name}` | Remove an endpoint            |
| GET    | `/health`               | Health check                  |

### MCP Protocol

| Method | Path | Description                             |
| ------ | ---- | --------------------------------------- |
| POST   | `/`  | MCP protocol requests (Streamable HTTP) |

## Endpoint Configuration

When adding an endpoint, provide the following configuration:

```typescript
{
  name: string;           // Unique tool name
  url: string;            // API endpoint URL (supports {param} placeholders)
  method: string;         // HTTP method: GET, POST, PUT, PATCH, DELETE
  description: string;    // Tool description for the LLM
  parameters: [           // Array of parameters
    {
      name: string;       // Parameter name
      type: string;       // Type: string, number, boolean, object, array
      description: string;// Parameter description
      required: boolean;  // Whether the parameter is required
      default?: any;      // Optional default value
    }
  ];
  headers?: object;       // Optional HTTP headers
  timeout?: number;       // Optional timeout in seconds (default: 30)
}
```

## Example: Adding Multiple Endpoints

```bash
# Add a GET endpoint
curl -X POST http://localhost:8080/api/endpoints \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get_weather",
    "url": "https://api.weather.com/v1/weather/{city}",
    "method": "GET",
    "description": "Get weather for a city",
    "parameters": [
      {
        "name": "city",
        "type": "string",
        "description": "City name",
        "required": true
      }
    ]
  }'

# Add a POST endpoint
curl -X POST http://localhost:8080/api/endpoints \
  -H "Content-Type: application/json" \
  -d '{
    "name": "create_user",
    "url": "https://api.example.com/users",
    "method": "POST",
    "description": "Create a new user",
    "parameters": [
      {
        "name": "username",
        "type": "string",
        "description": "Username",
        "required": true
      },
      {
        "name": "email",
        "type": "string",
        "description": "Email address",
        "required": true
      }
    ]
  }'
```

## Architecture

```
┌─────────────────────────────────────────────┐
│         HTTP Server (Express)               │
├─────────────────────────────────────────────┤
│  REST API          │  MCP Protocol          │
│  /api/endpoints    │  / (Streamable HTTP)   │
└────────┬───────────┴────────┬───────────────┘
         │                    │
         ▼                    ▼
┌─────────────────┐  ┌─────────────────────┐
│ EndpointManager │  │  DynamicMCPServer   │
│                 │  │                     │
│ - Add endpoint  │◄─┤ - Register tools    │
│ - Remove        │  │ - Notify clients    │
│ - List          │  │ - Handle tool calls │
│ - Call API      │  │                     │
└─────────────────┘  └─────────────────────┘
```

## Project Structure

```
src/
├── server.ts                  # Main HTTP server
├── mcp/
│   ├── DynamicMCPServer.ts   # MCP server implementation
│   └── EndpointManager.ts    # Endpoint management
└── types/
    ├── api.types.ts          # API-related types
    ├── mcp.types.ts          # MCP-related types
    └── index.ts              # Type exports
```

## Development

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

### Formatting

```bash
npm run format
```

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
