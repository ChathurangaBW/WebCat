#!/usr/bin/env node

/**
 * WebCat CLI — Main entry point.
 *
 * Usage:
 *   webcat                    Show help
 *   webcat server run         Start the WebCat server
 *   webcat --help             Show help
 *   webcat --version          Show version
 */

const VERSION = '0.1.0';

function parseArgs(args: string[]): { command: string; options: Record<string, string> } {
  let command = 'help';
  const options: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case 'server':
        command = args[i + 1] === 'run' ? 'server-run' : 'server-help';
        if (args[i + 1] === 'run') i++;
        break;
      case 'start':
        command = 'start';
        break;
      case '--port':
        options.port = args[++i] || '3456';
        break;
      case '--host':
        options.host = args[++i] || '127.0.0.1';
        break;
      case '--help':
      case '-h':
        command = 'help';
        break;
      case '--version':
      case '-v':
        command = 'version';
        break;
      default:
        if (!arg.startsWith('--') && command === 'help' && i === 0) {
          command = arg;
        }
        break;
    }
  }

  return { command, options };
}

function showHelp(): void {
  console.log(`
🐱  WebCat v${VERSION} — AI-assisted web-application penetration-testing platform

USAGE:
  webcat [command] [options]

COMMANDS:
  server run               Start the WebCat server
  server run --port <n>    Specify server port (default: 3456)
  server run --host <h>    Specify server host (default: 127.0.0.1)
  --help, -h               Show this help message
  --version, -v            Show version information

EXAMPLES:
  webcat server run                         Start server on default port
  webcat server run --port 8080             Start server on port 8080
  webcat --version                          Show version

ENVIRONMENT:
  WEBCAT_HOME             WebCat home directory (default: ~/.webcat)
  WEBCAT_PORT             Server port (overrides --port)
  WEBCAT_HOST             Server host

CONFIGURATION:
  ~/.webcat/config.json   User configuration
  .webcat/config.json     Project configuration
  ~/.webcat/mcp.json      User MCP connections
  .webcat/mcp.json        Project MCP connections

DOCUMENTATION:
  https://github.com/ChathurangaBW/WebCat
`);
}

async function runServer(options: Record<string, string>): Promise<void> {
  const port = parseInt(process.env.WEBCAT_PORT ?? options.port ?? '3456', 10);
  const host = process.env.WEBCAT_HOST ?? options.host ?? '127.0.0.1';

  console.log('🐱  WebCat v' + VERSION);
  console.log(`   Starting server on http://${host}:${port}`);
  console.log('');

  try {
    // Dynamic import so --help/--version work without deps installed
    const { createServer } = await import('@webcat/server');
    const { McpConnectionManager } = await import('@webcat/mcp-hub');
    const { ScopeEngine } = await import('@webcat/scope-engine');

    const mcpManager = new McpConnectionManager({
      envLookup: (name: string) => process.env[name],
    });

    const scopeEngine = new ScopeEngine([], [], {
      blockPrivateNetworks: true,
      blockDnsRebinding: true,
    });

    const server = await createServer({
      port,
      host,
      logger: true,
      mcpManager,
      scopeEngine,
    });

    await server.start();

    console.log('');
    console.log('🐱  WebCat is running!');
    console.log(`   API:  http://${host}:${port}/api/v1/health`);
    console.log(`   WS:   ws://${host}:${port}/ws`);
    console.log('');
    console.log('   Press Ctrl+C to stop');

    const shutdown = async () => {
      console.log('\nShutting down...');
      await server.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err: any) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') {
      console.error('Error: WebCat packages not found. Run `pnpm install` first.');
      console.error('Development: npx tsx apps/webcat-cli/src/main.ts server run');
      process.exit(1);
    }
    throw err;
  }
}

async function main(): Promise<void> {
  const { command, options } = parseArgs(process.argv.slice(2));

  switch (command) {
    case 'help':
      showHelp();
      break;
    case 'version':
      console.log(`WebCat v${VERSION}`);
      break;
    case 'server-run':
      await runServer(options);
      break;
    case 'start':
      await runServer(options);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
