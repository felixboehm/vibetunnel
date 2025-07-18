const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const { prodOptions } = require('./esbuild-config.js');

async function build() {
  console.log('Starting build process...');
  
  // Validate version sync
  console.log('Validating version sync...');
  execSync('node scripts/validate-version-sync.js', { stdio: 'inherit' });

  // Ensure directories exist
  console.log('Creating directories...');
  execSync('node scripts/ensure-dirs.js', { stdio: 'inherit' });

  // Copy assets
  console.log('Copying assets...');
  execSync('node scripts/copy-assets.js', { stdio: 'inherit' });

  // Build CSS
  console.log('Building CSS...');
  execSync('pnpm exec tailwindcss -i ./src/client/styles.css -o ./public/bundle/styles.css --minify', { stdio: 'inherit' });

  // Bundle client JavaScript
  console.log('Bundling client JavaScript...');

  try {
    // Build main app bundle
    await esbuild.build({
      ...prodOptions,
      entryPoints: ['src/client/app-entry.ts'],
      outfile: 'public/bundle/client-bundle.js',
    });

    // Build test bundle
    await esbuild.build({
      ...prodOptions,
      entryPoints: ['src/client/test-entry.ts'],
      outfile: 'public/bundle/test.js',
    });

    // Build screencap bundle
    await esbuild.build({
      ...prodOptions,
      entryPoints: ['src/client/screencap-entry.ts'],
      outfile: 'public/bundle/screencap.js',
    });

    // Build service worker
    await esbuild.build({
      ...prodOptions,
      entryPoints: ['src/client/sw.ts'],
      outfile: 'public/sw.js',
      format: 'iife', // Service workers need IIFE format
    });

    console.log('Client bundles built successfully');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }

  // Build server TypeScript
  console.log('Building server...');
  execSync('tsc', { stdio: 'inherit' });

  // Bundle CLI
  console.log('Bundling CLI...');
  try {
    await esbuild.build({
      entryPoints: ['src/cli.ts'],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'cjs',
      outfile: 'dist/vibetunnel-cli',
      external: [
        'node-pty',
        'authenticate-pam',
      ],
      minify: true,
      sourcemap: false,
      loader: {
        '.ts': 'ts',
        '.js': 'js',
      },
    });
    
    // Read the file and ensure it has exactly one shebang
    let content = fs.readFileSync('dist/vibetunnel-cli', 'utf8');
    
    // Remove any existing shebangs
    content = content.replace(/^#!.*\n/gm, '');
    
    // Add a single shebang at the beginning
    content = '#!/usr/bin/env node\n' + content;
    
    // Write the fixed content back
    fs.writeFileSync('dist/vibetunnel-cli', content);
    
    // Make the CLI executable
    fs.chmodSync('dist/vibetunnel-cli', '755');
    console.log('CLI bundle created successfully');
  } catch (error) {
    console.error('CLI bundling failed:', error);
    process.exit(1);
  }

  // Bundle Linux Server (server-only)
  console.log('Bundling Linux Server...');
  try {
    await esbuild.build({
      entryPoints: ['src/linux-server.ts'],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'cjs',
      outfile: 'dist/vibetunnel-linux',
      external: [
        'node-pty',
        'authenticate-pam',
      ],
      minify: true,
      sourcemap: false,
      loader: {
        '.ts': 'ts',
        '.js': 'js',
      },
    });
    
    // Read the file and ensure it has exactly one shebang
    let linuxContent = fs.readFileSync('dist/vibetunnel-linux', 'utf8');
    
    // Remove any existing shebangs
    linuxContent = linuxContent.replace(/^#!.*\n/gm, '');
    
    // Add a single shebang at the beginning
    linuxContent = '#!/usr/bin/env node\n' + linuxContent;
    
    // Write the fixed content back
    fs.writeFileSync('dist/vibetunnel-linux', linuxContent);
    
    // Make the Linux server executable
    fs.chmodSync('dist/vibetunnel-linux', '755');
    console.log('Linux Server bundle created successfully');
  } catch (error) {
    console.error('Linux Server bundling failed:', error);
    process.exit(1);
  }

  // Bundle Linux CLI (server + fwd functionality)
  console.log('Bundling Linux CLI...');
  try {
    await esbuild.build({
      entryPoints: ['src/cli.ts'],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'cjs',
      outfile: 'dist/vibetunnel-linux-cli',
      external: [
        'node-pty',
        'authenticate-pam',
      ],
      minify: true,
      sourcemap: false,
      loader: {
        '.ts': 'ts',
        '.js': 'js',
      },
    });
    
    // Read the file and ensure it has exactly one shebang
    let linuxCliContent = fs.readFileSync('dist/vibetunnel-linux-cli', 'utf8');
    
    // Remove any existing shebangs
    linuxCliContent = linuxCliContent.replace(/^#!.*\n/gm, '');
    
    // Add a single shebang at the beginning
    linuxCliContent = '#!/usr/bin/env node\n' + linuxCliContent;
    
    // Write the fixed content back
    fs.writeFileSync('dist/vibetunnel-linux-cli', linuxCliContent);
    
    // Make the Linux CLI executable
    fs.chmodSync('dist/vibetunnel-linux-cli', '755');
    console.log('Linux CLI bundle created successfully');
  } catch (error) {
    console.error('Linux CLI bundling failed:', error);
    process.exit(1);
  }


  // Build native executable
  console.log('Building native executable...');

  // Check if native binaries already exist (skip build for development)
  const nativeDir = path.join(__dirname, '..', 'native');
  const vibetunnelPath = path.join(nativeDir, 'vibetunnel');
  const ptyNodePath = path.join(nativeDir, 'pty.node');
  const spawnHelperPath = path.join(nativeDir, 'spawn-helper');

  if (fs.existsSync(vibetunnelPath) && fs.existsSync(ptyNodePath) && fs.existsSync(spawnHelperPath)) {
    console.log('✅ Native binaries already exist, skipping build...');
    console.log('  - vibetunnel executable: ✓');
    console.log('  - pty.node: ✓');
    console.log('  - spawn-helper: ✓');
  } else {
    // Check for --custom-node flag
    const useCustomNode = process.argv.includes('--custom-node');

    if (useCustomNode) {
      console.log('Using custom Node.js for smaller binary size...');
      execSync('node build-native.js --custom-node', { stdio: 'inherit' });
    } else {
      console.log('Using system Node.js...');
      execSync('node build-native.js', { stdio: 'inherit' });
    }
  }

  console.log('Build completed successfully!');
}

// Run the build
build().catch(error => {
  console.error('Build failed:', error);
  process.exit(1);
});