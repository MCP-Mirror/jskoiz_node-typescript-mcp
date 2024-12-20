# MCP Server for Node and TypeScript Documentation

A TypeScript-based MCP server that provides access to Node.js and TypeScript documentation.

### Tools
- `search_typescript_docs` - Search TypeScript documentation
  - Takes search query and optional category filter
  - Supports handbook, reference, release notes, declaration files, and JavaScript categories
  
- `search_node_docs` - Search Node.js documentation
  - Takes search query and optional version filter
  - Returns relevant documentation matches with context

## Development

Install dependencies:
```bash
npm install
```

Build the server:
```bash
npm run build
```

For development with auto-rebuild:
```bash
npm run watch
```

## Installation

To use with Claude Desktop, add the server config:

On MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "docs-reference-server": {
      "command": "/path/to/docs-reference-server/build/index.js"
    }
  }
}
```

### Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is available as a package script:

```bash
npm run inspector
```

The Inspector will provide a URL to access debugging tools in your browser.
