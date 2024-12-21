# MCP Documentation Reference Server

A TypeScript-based MCP server that provides modular access to various documentation sources including Node.js, TypeScript, and Discord.js.

## Documentation Sources

Currently supported documentation sources:

- **TypeScript**: Official TypeScript documentation including handbook, reference, release notes, and more
- **Node.js**: Core Node.js documentation
- **Discord.js**: Official Discord.js guide and documentation

## Installation

Install dependencies:

```bash
npm install
```

### Documentation Setup

You can choose which documentation sources to install:

```bash
# Install all documentation sources
npm run setup-docs:all

# Install specific documentation sources
npm run setup-docs:typescript
npm run setup-docs:node
npm run setup-docs:discord

# Interactive selection
npm run setup-docs
```

Then build the server:
```bash
npm run build
```

For development with auto-rebuild:
```bash
npm run watch
```

## Tools

- `search_typescript_docs` - Search TypeScript documentation
  - Takes search query and optional category filter
  - Supports handbook, reference, release notes, declaration files, and JavaScript categories

- `search_node_docs` - Search Node.js documentation
  - Takes search query and optional version filter
  - Returns relevant documentation matches with context

- `search_discord_docs` - Search Discord.js documentation
  - Takes search query and optional category filter
  - Supports categories like preparations, creating-your-bot, slash-commands, and more

## Integration

### Claude Desktop Integration

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

### Adding New Documentation Sources

Documentation sources are configured in `scripts/docs-config.js`. To add a new source:

1. Add the source configuration to `docSources`:
```javascript
{
  "source-key": {
    name: "Source Name",
    repo: "https://github.com/org/repo.git",
    setup: {
      sourcePath: ["path", "to", "docs"],
      targetPath: ["target", "path"]
    }
  }
}
```

2. Create a corresponding service implementation in `src/services/`
3. Register the service in `src/services/docs-service-registry.ts`

### Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is available as a package script:

```bash
npm run inspector
```

The Inspector will provide a URL to access debugging tools in your browser.
