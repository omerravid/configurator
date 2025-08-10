#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Configuration Manager - Installation Verification\n');

const checks = [
  {
    name: 'Node.js version',
    check: () => {
      const version = process.version;
      const major = parseInt(version.slice(1).split('.')[0]);
      if (major < 18) {
        throw new Error(`Node.js 18+ required, found ${version}`);
      }
      return `✅ ${version}`;
    }
  },
  {
    name: 'Server dependencies',
    check: () => {
      const packagePath = path.join(__dirname, 'server', 'package.json');
      if (!fs.existsSync(packagePath)) {
        throw new Error('Server package.json not found');
      }
      
      const nodeModulesPath = path.join(__dirname, 'server', 'node_modules');
      if (!fs.existsSync(nodeModulesPath)) {
        throw new Error('Server dependencies not installed. Run: npm run server:install');
      }
      
      // Check for key dependencies
      const keyDeps = ['express', 'mongoose', 'mongodb-memory-server'];
      for (const dep of keyDeps) {
        const depPath = path.join(nodeModulesPath, dep);
        if (!fs.existsSync(depPath)) {
          throw new Error(`Missing dependency: ${dep}`);
        }
      }
      
      return '✅ All server dependencies installed';
    }
  },
  {
    name: 'Client dependencies',
    check: () => {
      const packagePath = path.join(__dirname, 'client', 'package.json');
      if (!fs.existsSync(packagePath)) {
        throw new Error('Client package.json not found');
      }
      
      const nodeModulesPath = path.join(__dirname, 'client', 'node_modules');
      if (!fs.existsSync(nodeModulesPath)) {
        throw new Error('Client dependencies not installed. Run: npm run client:install');
      }
      
      return '✅ All client dependencies installed';
    }
  },
  {
    name: 'Configuration files',
    check: () => {
      const serverEnv = path.join(__dirname, 'server', '.env');
      const hasEnv = fs.existsSync(serverEnv);
      
      return hasEnv 
        ? '✅ Environment configuration found'
        : '⚠️  No .env file (will use defaults)';
    }
  },
  {
    name: 'Database setup',
    check: () => {
      const envPath = path.join(__dirname, 'server', '.env');
      let useMongoDB = true; // Default to MongoDB
      
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const mongoMatch = envContent.match(/USE_MONGODB=(.+)/);
        if (mongoMatch) {
          useMongoDB = mongoMatch[1].toLowerCase() === 'true';
        }
      }
      
      return useMongoDB 
        ? '✅ Configured for embedded MongoDB'
        : '✅ Configured for SQLite';
    }
  }
];

let allPassed = true;

for (const { name, check } of checks) {
  try {
    const result = check();
    console.log(`${name}: ${result}`);
  } catch (error) {
    console.log(`${name}: ❌ ${error.message}`);
    allPassed = false;
  }
}

console.log('\n' + '='.repeat(50));

if (allPassed) {
  console.log('🎉 Installation verification complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Run: npm run dev');
  console.log('2. Open: http://localhost:5173');
  console.log('3. Login with: admin / admin123');
  console.log('\n💡 Tip: The embedded MongoDB will start automatically!');
} else {
  console.log('❌ Installation issues found!');
  console.log('\n🔧 To fix issues:');
  console.log('1. Install dependencies: npm install');
  console.log('2. Check Node.js version: node --version');
  console.log('3. Review the README.md for detailed setup instructions');
  process.exit(1);
}
