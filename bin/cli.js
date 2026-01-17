#!/usr/bin/env node

/**
 * graphiti-claude-integration CLI
 *
 * Usage:
 *   npx graphiti-claude-integration install   - Install all Graphiti hooks + rules
 *   npx graphiti-claude-integration uninstall - Remove all Graphiti hooks + rules
 *   npx graphiti-claude-integration status    - Show installation status
 *
 * Installation is RELATIVE to current working directory:
 *   cd ~ && npx graphiti-claude-integration install       -> ~/.claude/
 *   cd /project && npx graphiti-claude-integration install -> /project/.claude/
 */

const fs = require('fs');
const path = require('path');

const PACKAGE_NAME = 'graphiti-claude-integration';

// Target paths (relative to current working directory)
const CLAUDE_DIR = path.join(process.cwd(), '.claude');
const HOOKS_DIR = path.join(CLAUDE_DIR, 'hooks');
const RULES_DIR = path.join(CLAUDE_DIR, 'rules');
const SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json');
const STATE_PATH = path.join(CLAUDE_DIR, `${PACKAGE_NAME}-state.json`);

// Source paths (relative to package root)
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const SOURCE_HOOKS_DIR = path.join(PACKAGE_ROOT, 'hooks');
const SOURCE_RULES_DIR = path.join(PACKAGE_ROOT, 'rules');

// All hooks (Graphiti is one package - all hooks work together)
const HOOKS = {
  'session-start': ['graphiti-context-loader.py'],
  'user-prompt-submit': ['session-reminder.py'],
  'pre-tool-use': ['graphiti-guard.py']
};

// PreToolUse matchers for graphiti-guard.py
const PRETOOLUSE_MATCHERS = ['mcp__graphiti.*', 'mcp__mcp-funnel__bridge_tool_request'];

// Rules
const RULES = ['graphiti.md'];

// Shared library from claude-hooks-core
const SHARED_LIB = ['session_state.py'];

function getCorePath() {
  try {
    return path.dirname(require.resolve('claude-hooks-core/package.json'));
  } catch (e) {
    error('claude-hooks-core not found. Run: npm install');
    return null;
  }
}

function log(msg) {
  console.log(`[${PACKAGE_NAME}] ${msg}`);
}

function warn(msg) {
  console.log(`[${PACKAGE_NAME}] WARNING: ${msg}`);
}

function error(msg) {
  console.error(`[${PACKAGE_NAME}] ERROR: ${msg}`);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFile(source, dest) {
  try {
    // Remove existing file/symlink first (fs.copyFileSync follows symlinks!)
    if (fs.existsSync(dest) || fs.lstatSync(dest).isSymbolicLink()) {
      fs.unlinkSync(dest);
    }
  } catch (e) {
    // File doesn't exist, that's fine
  }

  try {
    fs.copyFileSync(source, dest);
    if (dest.endsWith('.py')) {
      fs.chmodSync(dest, 0o755);
    }
    return true;
  } catch (e) {
    error(`Failed to copy ${source} to ${dest}: ${e.message}`);
    return false;
  }
}

function deleteFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (e) {
    error(`Failed to delete ${filePath}: ${e.message}`);
  }
  return false;
}

// State file handling
function readState() {
  try {
    if (fs.existsSync(STATE_PATH)) {
      return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    }
  } catch (e) {
    error(`Failed to read state: ${e.message}`);
  }
  return { installed: false, hook_commands: [] };
}

function writeState(state) {
  try {
    ensureDir(CLAUDE_DIR);
    state.installed_at = new Date().toISOString();
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
    return true;
  } catch (e) {
    error(`Failed to write state: ${e.message}`);
    return false;
  }
}

function deleteState() {
  return deleteFile(STATE_PATH);
}

function readSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    }
  } catch (e) {
    error(`Failed to read settings: ${e.message}`);
  }
  return {};
}

function writeSettings(settings) {
  try {
    ensureDir(CLAUDE_DIR);
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
    return true;
  } catch (e) {
    error(`Failed to write settings: ${e.message}`);
    return false;
  }
}

function installSharedLibrary() {
  const corePath = getCorePath();
  if (!corePath) return false;

  ensureDir(path.join(HOOKS_DIR, 'lib'));
  for (const libFile of SHARED_LIB) {
    const source = path.join(corePath, 'lib', libFile);
    const dest = path.join(HOOKS_DIR, 'lib', libFile);
    if (fs.existsSync(source) && copyFile(source, dest)) {
      log(`Installed lib: ${libFile} (from claude-hooks-core)`);
    }
  }
  return true;
}

function install() {
  log('Installing Graphiti integration...');
  log(`Target: ${CLAUDE_DIR}`);

  // Install shared library from claude-hooks-core
  installSharedLibrary();

  // Create directories
  for (const hookType of Object.keys(HOOKS)) {
    ensureDir(path.join(HOOKS_DIR, hookType));
  }
  ensureDir(RULES_DIR);

  let installed = { hooks: 0, rules: 0 };
  const hookCommands = [];

  // Install hooks
  for (const [hookType, files] of Object.entries(HOOKS)) {
    for (const file of files) {
      const source = path.join(SOURCE_HOOKS_DIR, hookType, file);
      const dest = path.join(HOOKS_DIR, hookType, file);

      if (fs.existsSync(source)) {
        if (copyFile(source, dest)) {
          installed.hooks++;
          hookCommands.push(dest);
          log(`Installed hook: ${file}`);
        }
      } else {
        error(`Source hook not found: ${source}`);
      }
    }
  }

  // Install rules
  for (const rule of RULES) {
    const source = path.join(SOURCE_RULES_DIR, rule);
    const dest = path.join(RULES_DIR, rule);

    if (fs.existsSync(source)) {
      if (copyFile(source, dest)) {
        installed.rules++;
        log(`Installed rule: ${rule}`);
      }
    } else {
      error(`Source rule not found: ${source}`);
    }
  }

  // Update settings.json
  const state = readState();
  updateSettings(state.hook_commands || [], hookCommands);

  // Write state file
  writeState({
    installed: true,
    hook_commands: hookCommands
  });

  log(`\nInstallation complete: ${installed.hooks} hooks, ${installed.rules} rules`);
}

function updateSettings(oldHookCommands, newHookCommands) {
  const settings = readSettings();
  if (!settings.hooks) {
    settings.hooks = {};
  }

  // Remove old hook entries by matching command paths
  const oldCommandSet = new Set(oldHookCommands);

  // Clean up SessionStart
  if (settings.hooks.SessionStart) {
    settings.hooks.SessionStart = settings.hooks.SessionStart.map(entry => {
      if (!entry.hooks) return entry;
      entry.hooks = entry.hooks.filter(h => !oldCommandSet.has(h.command));
      return entry;
    }).filter(entry => entry.hooks && entry.hooks.length > 0);
  }

  // Clean up UserPromptSubmit
  if (settings.hooks.UserPromptSubmit) {
    settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit.map(entry => {
      if (!entry.hooks) return entry;
      entry.hooks = entry.hooks.filter(h => !oldCommandSet.has(h.command));
      return entry;
    }).filter(entry => entry.hooks && entry.hooks.length > 0);
  }

  // Clean up PreToolUse
  if (settings.hooks.PreToolUse) {
    settings.hooks.PreToolUse = settings.hooks.PreToolUse.map(entry => {
      if (!entry.hooks) return entry;
      entry.hooks = entry.hooks.filter(h => !oldCommandSet.has(h.command));
      return entry;
    }).filter(entry => entry.hooks && entry.hooks.length > 0);
  }

  // Skip if no new hooks to add (uninstall case)
  if (newHookCommands.length === 0) {
    writeSettings(settings);
    log('Updated settings.json');
    return;
  }

  // Add SessionStart hook
  if (!settings.hooks.SessionStart) {
    settings.hooks.SessionStart = [];
  }
  const sessionStartHook = {
    type: 'command',
    command: path.join(HOOKS_DIR, 'session-start', 'graphiti-context-loader.py')
  };
  // Check if already exists
  const sessionStartExists = settings.hooks.SessionStart.some(entry =>
    entry.hooks?.some(h => h.command === sessionStartHook.command)
  );
  if (!sessionStartExists) {
    settings.hooks.SessionStart.push({
      hooks: [sessionStartHook]
    });
  }

  // Add UserPromptSubmit hook
  if (!settings.hooks.UserPromptSubmit) {
    settings.hooks.UserPromptSubmit = [];
  }
  const userPromptHook = {
    type: 'command',
    command: path.join(HOOKS_DIR, 'user-prompt-submit', 'session-reminder.py')
  };
  const userPromptExists = settings.hooks.UserPromptSubmit.some(entry =>
    entry.hooks?.some(h => h.command === userPromptHook.command)
  );
  if (!userPromptExists) {
    settings.hooks.UserPromptSubmit.push({
      hooks: [userPromptHook]
    });
  }

  // Add PreToolUse hooks (with matchers)
  if (!settings.hooks.PreToolUse) {
    settings.hooks.PreToolUse = [];
  }
  const graphitiGuardPath = path.join(HOOKS_DIR, 'pre-tool-use', 'graphiti-guard.py');

  for (const matcher of PRETOOLUSE_MATCHERS) {
    const existing = settings.hooks.PreToolUse.find(e => e.matcher === matcher);
    if (existing) {
      // Add to existing matcher entry if not already present
      if (!existing.hooks.some(h => h.command === graphitiGuardPath)) {
        existing.hooks.push({
          type: 'command',
          command: graphitiGuardPath
        });
      }
    } else {
      // Create new entry
      settings.hooks.PreToolUse.push({
        matcher,
        hooks: [{
          type: 'command',
          command: graphitiGuardPath
        }]
      });
    }
  }

  writeSettings(settings);
  log('Updated settings.json');
}

function uninstall() {
  log('Uninstalling Graphiti integration...');

  const state = readState();
  let removed = { hooks: 0, rules: 0 };

  // Remove hooks
  for (const [hookType, files] of Object.entries(HOOKS)) {
    for (const file of files) {
      const filePath = path.join(HOOKS_DIR, hookType, file);
      if (deleteFile(filePath)) {
        removed.hooks++;
        log(`Removed: ${file}`);
      }
    }
  }

  // Remove rules
  for (const rule of RULES) {
    const filePath = path.join(RULES_DIR, rule);
    if (deleteFile(filePath)) {
      removed.rules++;
      log(`Removed: ${rule}`);
    }
  }

  // Update settings.json
  updateSettings(state.hook_commands || [], []);

  // Delete state file
  if (deleteState()) {
    log('Removed state file');
  }

  log(`\nUninstall complete: removed ${removed.hooks} hooks, ${removed.rules} rules`);
}

function status() {
  console.log('\n=== graphiti-claude-integration Status ===');
  console.log(`Target: ${CLAUDE_DIR}\n`);

  // Check hooks
  let hooksInstalled = 0;
  let hooksTotal = 0;
  for (const [hookType, files] of Object.entries(HOOKS)) {
    for (const file of files) {
      hooksTotal++;
      const filePath = path.join(HOOKS_DIR, hookType, file);
      const exists = fs.existsSync(filePath);
      const status = exists ? '  Installed' : '  Not installed';
      if (exists) hooksInstalled++;
      console.log(`  ${hookType}/${file}: ${status}`);
    }
  }

  // Check rules
  let rulesInstalled = 0;
  for (const rule of RULES) {
    const filePath = path.join(RULES_DIR, rule);
    const exists = fs.existsSync(filePath);
    const status = exists ? '  Installed' : '  Not installed';
    if (exists) rulesInstalled++;
    console.log(`  rules/${rule}: ${status}`);
  }

  // Check shared library
  const libExists = SHARED_LIB.every(f =>
    fs.existsSync(path.join(HOOKS_DIR, 'lib', f))
  );
  console.log(`\nShared library (claude-hooks-core):`);
  console.log(`  session_state.py: ${libExists ? '  Installed' : '  Not installed'}`);
  if (!libExists) {
    console.log('  -> Will be installed automatically from claude-hooks-core');
  }

  // State file
  const stateExists = fs.existsSync(STATE_PATH);
  console.log(`\nState file: ${stateExists ? '  Exists' : '  Not found'}`);

  // Summary
  const allInstalled = hooksInstalled === hooksTotal && rulesInstalled === RULES.length;
  console.log(`\nOverall: ${allInstalled ? '  Fully installed' : '  Not fully installed'}`);
  console.log('');
}

// Main
const command = process.argv[2];

switch (command) {
  case 'install':
    install();
    break;
  case 'uninstall':
    uninstall();
    break;
  case 'status':
    status();
    break;
  default:
    console.log(`
graphiti-claude-integration - Graphiti knowledge graph for Claude Code

Usage:
  npx graphiti-claude-integration install   - Install all hooks + rules
  npx graphiti-claude-integration uninstall - Remove all hooks + rules
  npx graphiti-claude-integration status    - Show installation status

Installation target is relative to current directory:
  cd ~        -> installs to ~/.claude/
  cd /project -> installs to /project/.claude/

Note: Requires shared-claude-rules for session_state.py
`);
}
