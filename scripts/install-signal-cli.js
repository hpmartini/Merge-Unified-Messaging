#!/usr/bin/env node
/**
 * Downloads and extracts signal-cli for Signal messaging integration.
 * Run automatically via `npm install` postinstall hook.
 */

import { existsSync, mkdirSync, createWriteStream, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SIGNAL_CLI_VERSION = '0.13.2';
const SIGNAL_CLI_DIR = join(__dirname, '..', 'server', 'signal-cli');
const SIGNAL_CLI_PATH = join(SIGNAL_CLI_DIR, `signal-cli-${SIGNAL_CLI_VERSION}`);

const DOWNLOAD_URL = `https://github.com/AsamK/signal-cli/releases/download/v${SIGNAL_CLI_VERSION}/signal-cli-${SIGNAL_CLI_VERSION}.tar.gz`;

async function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);

    const request = (url) => {
      https.get(url, (response) => {
        // Handle redirects
        if (response.statusCode === 302 || response.statusCode === 301) {
          request(response.headers.location);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Download failed with status ${response.statusCode}`));
          return;
        }

        const total = parseInt(response.headers['content-length'], 10);
        let downloaded = 0;

        response.on('data', (chunk) => {
          downloaded += chunk.length;
          const percent = total ? Math.round((downloaded / total) * 100) : '?';
          process.stdout.write(`\r  Downloading signal-cli... ${percent}%`);
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          console.log(' Done!');
          resolve();
        });
      }).on('error', (err) => {
        unlinkSync(dest);
        reject(err);
      });
    };

    request(url);
  });
}

async function extract(tarPath, destDir) {
  return new Promise((resolve, reject) => {
    process.stdout.write('  Extracting signal-cli...');
    // Use execFile with explicit arguments to avoid shell injection
    execFile('tar', ['-xzf', tarPath, '-C', destDir], (error) => {
      if (error) {
        reject(error);
      } else {
        console.log(' Done!');
        resolve();
      }
    });
  });
}

async function checkJava() {
  return new Promise((resolve) => {
    execFile('java', ['-version'], (error) => {
      resolve(!error);
    });
  });
}

async function main() {
  console.log('\n📱 Signal CLI Setup\n');

  // Check if already installed
  if (existsSync(join(SIGNAL_CLI_PATH, 'bin', 'signal-cli'))) {
    console.log(`  ✓ signal-cli ${SIGNAL_CLI_VERSION} already installed\n`);
    return;
  }

  // Check Java
  const hasJava = await checkJava();
  if (!hasJava) {
    console.log('  ⚠️  Java not found. Signal integration requires Java 21+.');
    console.log('     Install with: brew install openjdk@21\n');
    // Don't fail - let user install Java later
  }

  // Create directory
  if (!existsSync(SIGNAL_CLI_DIR)) {
    mkdirSync(SIGNAL_CLI_DIR, { recursive: true });
  }

  const tarPath = join(SIGNAL_CLI_DIR, `signal-cli-${SIGNAL_CLI_VERSION}.tar.gz`);

  try {
    // Download
    await download(DOWNLOAD_URL, tarPath);

    // Extract
    await extract(tarPath, SIGNAL_CLI_DIR);

    // Cleanup tar file
    unlinkSync(tarPath);

    console.log(`\n  ✓ signal-cli ${SIGNAL_CLI_VERSION} installed successfully!\n`);
  } catch (error) {
    console.error(`\n  ✗ Failed to install signal-cli: ${error.message}`);
    console.error(`    You can manually download from:`);
    console.error(`    ${DOWNLOAD_URL}\n`);
    // Don't fail npm install
  }
}

main();
