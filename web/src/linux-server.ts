#!/usr/bin/env node

/**
 * Linux Server Entry Point for VibeTunnel
 * 
 * This is a standalone entry point optimized for Linux server deployments.
 * It removes macOS-specific dependencies and provides a clean server-only experience.
 */

// Suppress xterm.js errors globally - must be before any other imports
import { suppressXtermErrors } from './shared/suppress-xterm-errors.js';

suppressXtermErrors();

import { startVibeTunnelServer } from './server/server.js';
import { closeLogger, createLogger, initLogger } from './server/utils/logger.js';
import { VERSION } from './server/version.js';
import chalk from 'chalk';
import * as os from 'os';

// Initialize logger
const debugMode = process.env.VIBETUNNEL_DEBUG === '1' || process.env.VIBETUNNEL_DEBUG === 'true';
initLogger(debugMode);
const logger = createLogger('linux-server');

// Server configuration
const DEFAULT_PORT = 4020;
const DEFAULT_HOST = '0.0.0.0';

// Parse command line arguments
interface ServerConfig {
  port: number;
  host: string;
  noAuth: boolean;
  help: boolean;
  version: boolean;
}

function parseArgs(): ServerConfig {
  const args = process.argv.slice(2);
  const config: ServerConfig = {
    port: parseInt(process.env.PORT || '') || DEFAULT_PORT,
    host: process.env.HOST || DEFAULT_HOST,
    noAuth: process.env.NO_AUTH === '1' || process.env.NO_AUTH === 'true',
    help: false,
    version: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--port':
      case '-p':
        config.port = parseInt(args[++i]) || DEFAULT_PORT;
        break;
      case '--host':
      case '-h':
        config.host = args[++i] || DEFAULT_HOST;
        break;
      case '--no-auth':
        config.noAuth = true;
        break;
      case '--help':
        config.help = true;
        break;
      case '--version':
      case '-v':
        config.version = true;
        break;
    }
  }

  return config;
}

function showHelp() {
  console.log(`
${chalk.blue('VibeTunnel Linux Server')} v${VERSION}

${chalk.bold('Usage:')}
  vibetunnel [options]

${chalk.bold('Options:')}
  -p, --port <port>     Server port (default: ${DEFAULT_PORT})
  -h, --host <host>     Bind address (default: ${DEFAULT_HOST})
  --no-auth            Disable authentication (development only)
  --version, -v        Show version information
  --help               Show this help message

${chalk.bold('Environment Variables:')}
  PORT                 Server port
  HOST                 Bind address
  NO_AUTH              Disable authentication (1 or true)
  VIBETUNNEL_DEBUG     Enable debug logging (1 or true)

${chalk.bold('Examples:')}
  vibetunnel                          # Start with default settings
  vibetunnel --port 8080              # Start on port 8080
  vibetunnel --host localhost         # Bind to localhost only
  PORT=3000 vibetunnel                # Use environment variable
  VIBETUNNEL_DEBUG=1 vibetunnel       # Start with debug logging

${chalk.bold('Access:')}
  Open http://your-server-ip:${DEFAULT_PORT} in your browser

${chalk.bold('Documentation:')}
  https://github.com/felixboehm/vibetunnel/blob/main/LINUX_SERVER.md
`);
}

function showVersion() {
  console.log(`VibeTunnel Linux Server v${VERSION}`);
  console.log(`Node.js ${process.version}`);
  console.log(`Platform: ${os.platform()} ${os.arch()}`);
  console.log(`OS: ${os.type()} ${os.release()}`);
}

function showStartupBanner(config: ServerConfig) {
  console.log();
  console.log(chalk.blue.bold('🌐 VibeTunnel Linux Server'));
  console.log(chalk.gray(`   Version: ${VERSION}`));
  console.log(chalk.gray(`   Node.js: ${process.version}`));
  console.log(chalk.gray(`   Platform: ${os.platform()} ${os.arch()}`));
  console.log();
  console.log(chalk.green('🚀 Starting server...'));
  console.log(chalk.gray(`   Host: ${config.host}`));
  console.log(chalk.gray(`   Port: ${config.port}`));
  console.log(chalk.gray(`   Auth: ${config.noAuth ? 'disabled' : 'enabled'}`));
  console.log(chalk.gray(`   Debug: ${debugMode ? 'enabled' : 'disabled'}`));
  console.log();
  
  if (config.noAuth) {
    console.log(chalk.yellow.bold('⚠️  WARNING: Authentication is disabled!'));
    console.log(chalk.yellow('   This should only be used for development.'));
    console.log();
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  logger.error('Stack trace:', error.stack);
  closeLogger();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  if (reason instanceof Error) {
    logger.error('Stack trace:', reason.stack);
  }
  closeLogger();
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.log('SIGTERM received, shutting down gracefully...');
  closeLogger();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.log('SIGINT received, shutting down gracefully...');
  closeLogger();
  process.exit(0);
});

// Main execution
async function main() {
  const config = parseArgs();

  if (config.help) {
    showHelp();
    process.exit(0);
  }

  if (config.version) {
    showVersion();
    process.exit(0);
  }

  showStartupBanner(config);

  try {
    // Set environment variables for the server
    process.env.PORT = config.port.toString();
    process.env.HOST = config.host;
    if (config.noAuth) {
      process.env.NO_AUTH = '1';
    }

    // Start the VibeTunnel server
    await startVibeTunnelServer();

    logger.log('Server started successfully');
    console.log(chalk.green.bold('✅ Server is running!'));
    console.log();
    console.log(chalk.bold('Access URLs:'));
    
    if (config.host === '0.0.0.0') {
      console.log(chalk.blue(`   Local:    http://localhost:${config.port}`));
      console.log(chalk.blue(`   Network:  http://your-server-ip:${config.port}`));
    } else {
      console.log(chalk.blue(`   Server:   http://${config.host}:${config.port}`));
    }
    
    console.log();
    console.log(chalk.gray('Press Ctrl+C to stop the server'));
    console.log();

  } catch (error) {
    logger.error('Failed to start server:', error);
    console.error(chalk.red.bold('❌ Failed to start server'));
    if (error instanceof Error) {
      console.error(chalk.red(error.message));
      if (debugMode) {
        console.error(chalk.gray(error.stack));
      }
    }
    closeLogger();
    process.exit(1);
  }
}

// Only execute if this is the main module
if (require.main === module) {
  main().catch((error) => {
    console.error(chalk.red.bold('❌ Fatal error:'), error);
    closeLogger();
    process.exit(1);
  });
}

export { main as startLinuxServer };