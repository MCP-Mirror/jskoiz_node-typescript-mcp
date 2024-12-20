# Node TypeScript MCP Server

MCP server that provides documentation search capabilities for TypeScript and Node.js. It's designed to integrate with AI assistants that support the Model Context Protocol.

## Features

- **TypeScript Documentation Search**: Search through the TypeScript handbook for specific topics, concepts, and examples
- **Node.js Documentation Search**: Search through Node.js API documentation across different versions
- Real-time content fetching and parsing
- Context-aware search results with relevant code snippets
- Category-based filtering for TypeScript documentation
- Version-specific searches for Node.js documentation

## Installation

```bash
# Clone the repository
git clone https://github.com/jskoiz/node-typescript-mcp.git

# Navigate to the project directory
cd node-typescript-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

## Usage

The server provides two main tools that can be accessed through the MCP protocol:

### 1. search_typescript_docs

Search through TypeScript documentation with optional category filtering.

```typescript
{
  name: 'search_typescript_docs',
  arguments: {
    query: string;  // e.g., "interfaces", "generics", "type guards"
    category?: 'handbook' | 'reference' | 'release-notes' | 'declaration-files' | 'javascript'
  }
}
```

### 2. search_node_docs

Search through Node.js documentation with optional version specification.

```typescript
{
  name: 'search_node_docs',
  arguments: {
    query: string;  // e.g., "fs", "http", "buffer"
    version?: string;  // defaults to 'latest'
  }
}
```

## Development

```bash
# Start the server in development mode
npm start

# Run the server with the MCP inspector
npm run inspector

# Watch for changes during development
npm run watch
```

## Project Structure

```
.
├── src/
│   └── index.ts    # Main server implementation
├── build/          # Compiled JavaScript output
├── package.json    # Project configuration and dependencies
└── tsconfig.json   # TypeScript configuration
```

## Dependencies

- [@modelcontextprotocol/sdk](https://github.com/ModelContext/protocol): ^0.6.0
- [axios](https://github.com/axios/axios): ^1.7.9
- [cheerio](https://github.com/cheeriojs/cheerio): ^1.0.0
- TypeScript: ^5.3.3

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License

## Acknowledgments

- TypeScript Documentation: [typescriptlang.org](https://www.typescriptlang.org/docs/)
- Node.js Documentation: [nodejs.org/docs](https://nodejs.org/docs/)
