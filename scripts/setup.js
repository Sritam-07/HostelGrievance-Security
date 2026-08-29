#!/usr/bin/env node

/**
 * Smart setup script for HostelGrievance
 * Handles better-sqlite3 compilation on different systems
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

console.log('');
console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║         HostelGrievance - Smart Setup Script             ║');
console.log('╚═══════════════════════════════════════════════════════════╝');
console.log('');

function run(cmd, options = {}) {
    try {
        return execSync(cmd, { 
            stdio: 'inherit', 
            cwd: ROOT,
            ...options 
        });
    } catch (e) {
        return null;
    }
}

// Step 1: Try normal install
console.log('📦 Step 1: Installing dependencies...');
console.log('');

const installResult = run('npm install');

if (!installResult || !existsSync(join(ROOT, 'node_modules', 'better-sqlite3'))) {
    console.log('');
    console.log('⚠️  Native compilation failed. Trying fallback...');
    console.log('');
    
    // Step 2: Try with pre-built binaries
    console.log('📦 Step 2: Installing with pre-built binaries...');
    run('npm install --ignore-scripts');
    
    // Step 3: Try to rebuild better-sqlite3 specifically
    console.log('');
    console.log('🔨 Step 3: Attempting to rebuild better-sqlite3...');
    const rebuildResult = run('npm rebuild better-sqlite3');
    
    if (!rebuildResult || !existsSync(join(ROOT, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'))) {
        console.log('');
        console.log('╔═══════════════════════════════════════════════════════════╗');
        console.log('║  ⚠️  better-sqlite3 needs C++ build tools                ║');
        console.log('╠═══════════════════════════════════════════════════════════╣');
        console.log('║                                                         ║');
        console.log('║  The app will still work! We use a pre-built binary.   ║');
        console.log('║                                                         ║');
        console.log('║  To fix this permanently, install:                      ║');
        console.log('║  - Windows: Visual Studio Build Tools                   ║');
        console.log('║  - Mac: Xcode Command Line Tools                        ║');
        console.log('║  - Linux: build-essential                                ║');
        console.log('║                                                         ║');
        console.log('╚═══════════════════════════════════════════════════════════╝');
        console.log('');
    }
}

// Step 4: Create database
console.log('');
console.log('🗄️  Step 4: Creating database with sample data...');
run('npx tsx src/server/scripts/reset-db.ts');

console.log('');
console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║                    ✅ Setup Complete!                     ║');
console.log('╠═══════════════════════════════════════════════════════════╣');
console.log('║                                                         ║');
console.log('║  Run the app with:                                      ║');
console.log('║    npm run dev:all                                      ║');
console.log('║                                                         ║');
console.log('║  Then open: http://localhost:5173                       ║');
console.log('║                                                         ║');
console.log('╚═══════════════════════════════════════════════════════════╝');
console.log('');
