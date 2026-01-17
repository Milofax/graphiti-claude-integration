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

// Get cwd safely
function getCwd() {
  try {
    return process.cwd();
  } catch (e) {
    return null;
  }
}

const CWD = getCwd();

// Target paths (relative to current working directory)
// NEW: Subdirectory structure for isolation
const CLAUDE_DIR = CWD ? path.join(CWD, '.claude') : null;
const HOOKS_DIR = CLAUDE_DIR ? path.join(CLAUDE_DIR, 'hooks', PACKAGE_NAME) : null;
const RULES_DIR = CLAUDE_DIR ? path.join(CLAUDE_DIR, 'rules', PACKAGE_NAME) : null;
const SETTINGS_PATH = CLAUDE_DIR ? path.join(CLAUDE_DIR, 'settings.json') : null;
const STATE_PATH = CLAUDE_DIR ? path.join(CLAUDE_DIR, `${PACKAGE_NAME}-state.json`) : null;

// Legacy paths (for cleanup detection)
const LEGACY_HOOKS_DIR = CLAUDE_DIR ? path.join(CLAUDE_DIR, 'hooks') : null;
const LEGACY_RULES_DIR = CLAUDE_DIR ? path.join(CLAUDE_DIR, 'rules') : null;

// Source paths (relative to package root)
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const SOURCE_HOOKS_DIR = path.join(PACKAGE_ROOT, 'hooks');
const SOURCE_RULES_DIR = path.join(PACKAGE_ROOT, 'rules');

// All hooks (Graphiti is one package - all hooks work together)
const HOOKS = {
  'session-start': ['graphiti-context-loader.py'],
  'user-prompt-submit': ['session-reminder.py'],
  'pre-tool-use': ['graphiti-guard.py', 'graphiti-first-guard.py']
};

// PreToolUse matchers - which hooks trigger on which tools
const PRETOOLUSE_HOOKS = {
  'graphiti-guard.py': ['mcp__graphiti.*', 'mcp__mcp-funnel__bridge_tool_request'],
  'graphiti-first-guard.py': ['WebSearch|WebFetch', 'mcp__mcp-funnel__bridge_tool_request']
};

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

/**
 * Validate environment before running commands
 * Returns { valid: boolean, error?: string }
 */
function validateEnvironment() {
  // Check 1: CWD exists
  if (!CWD) {
    return {
      valid: false,
      error: 'Current working directory does not exist or was deleted.\n' +
             'Please cd to a valid directory and try again.'
    };
  }

  // Check 2: CWD is accessible
  try {
    fs.accessSync(CWD, fs.constants.R_OK);
  } catch (e) {
    return {
      valid: false,
      error: `Cannot access current directory: ${CWD}\n` +
             'Check permissions and try again.'
    };
  }

  // Check 3: If .claude exists, it must be a directory (not a file)
  if (fs.existsSync(CLAUDE_DIR)) {
    const stat = fs.statSync(CLAUDE_DIR);
    if (!stat.isDirectory()) {
      return {
        valid: false,
        error: `${CLAUDE_DIR} exists but is not a directory.\n` +
               'Please remove or rename it and try again.'
      };
    }
  }

  // Check 4: Can write to target directory
  const testDir = fs.existsSync(CLAUDE_DIR) ? CLAUDE_DIR : CWD;
  try {
    fs.accessSync(testDir, fs.constants.W_OK);
  } catch (e) {
    return {
      valid: false,
      error: `No write permission in: ${testDir}\n` +
             'Check permissions and try again.'
    };
  }

  // Check 5: Source package is complete
  if (!fs.existsSync(SOURCE_HOOKS_DIR) || !fs.existsSync(SOURCE_RULES_DIR)) {
    return {
      valid: false,
      error: 'Package installation is incomplete.\n' +
             'Try reinstalling: npm install graphiti-claude-integration'
    };
  }

  return { valid: true };
}

/**
 * Check if a file/symlink exists at path
 */
function fileExists(filePath) {
  try {
    fs.lstatSync(filePath);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Detect if graphiti is installed (checks both legacy and new paths)
 */
function detectInstalled() {
  const newPath = path.join(RULES_DIR, 'graphiti.md');
  const legacyPath = path.join(LEGACY_RULES_DIR, 'graphiti.md');
  return fileExists(newPath) || fileExists(legacyPath);
}

/**
 * Remove ALL legacy files (for migration)
 */
function removeAllLegacyFiles() {
  let removed = 0;

  // Remove legacy hooks
  for (const [hookType, files] of Object.entries(HOOKS)) {
    for (const file of files) {
      const legacyPath = path.join(LEGACY_HOOKS_DIR, hookType, file);
      if (fileExists(legacyPath)) {
        try {
          fs.unlinkSync(legacyPath);
          log(`Migrated: ${file}`);
          removed++;
        } catch (e) {
          // Ignore
        }
      }
    }
  }

  // Remove legacy rules
  for (const rule of RULES) {
    const legacyPath = path.join(LEGACY_RULES_DIR, rule);
    if (fileExists(legacyPath)) {
      try {
        fs.unlinkSync(legacyPath);
        log(`Migrated: ${rule}`);
        removed++;
      } catch (e) {
        // Ignore
      }
    }
  }

  // Remove legacy lib
  const legacyLib = path.join(LEGACY_HOOKS_DIR, 'lib', 'session_state.py');
  if (fileExists(legacyLib)) {
    try {
      fs.unlinkSync(legacyLib);
      log('Migrated: session_state.py');
      removed++;
    } catch (e) {
      // Ignore
    }
  }

  return removed;
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

  // Migrate ALL legacy files first (seamless upgrade)
  const migrated = removeAllLegacyFiles();
  if (migrated > 0) {
    log(`Migrated ${migrated} legacy files to new structure`);
  }

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

  // Register each hook with its matchers
  for (const [hookFile, matchers] of Object.entries(PRETOOLUSE_HOOKS)) {
    const hookPath = path.join(HOOKS_DIR, 'pre-tool-use', hookFile);
    for (const matcher of matchers) {
      const existing = settings.hooks.PreToolUse.find(e => e.matcher === matcher);
      if (existing) {
        // Add to existing matcher entry if not already present
        if (!existing.hooks.some(h => h.command === hookPath)) {
          existing.hooks.push({
            type: 'command',
            command: hookPath
          });
        }
      } else {
        // Create new entry
        settings.hooks.PreToolUse.push({
          matcher,
          hooks: [{
            type: 'command',
            command: hookPath
          }]
        });
      }
    }
  }

  writeSettings(settings);
  log('Updated settings.json');
}

function uninstall() {
  log('Uninstalling Graphiti integration...');

  const state = readState();
  let removed = { hooks: 0, rules: 0 };

  // Remove hooks (both new and legacy paths)
  for (const [hookType, files] of Object.entries(HOOKS)) {
    for (const file of files) {
      // Try new path
      const filePath = path.join(HOOKS_DIR, hookType, file);
      if (deleteFile(filePath)) {
        removed.hooks++;
        log(`Removed: ${file}`);
      }
      // Try legacy path
      const legacyPath = path.join(LEGACY_HOOKS_DIR, hookType, file);
      if (deleteFile(legacyPath)) {
        removed.hooks++;
        log(`Removed (legacy): ${file}`);
      }
    }
  }

  // Remove rules (both new and legacy paths)
  for (const rule of RULES) {
    // Try new path
    const filePath = path.join(RULES_DIR, rule);
    if (deleteFile(filePath)) {
      removed.rules++;
      log(`Removed: ${rule}`);
    }
    // Try legacy path
    const legacyPath = path.join(LEGACY_RULES_DIR, rule);
    if (deleteFile(legacyPath)) {
      removed.rules++;
      log(`Removed (legacy): ${rule}`);
    }
  }

  // Remove shared library (both paths)
  for (const libFile of SHARED_LIB) {
    const libPath = path.join(HOOKS_DIR, 'lib', libFile);
    if (deleteFile(libPath)) {
      log(`Removed lib: ${libFile}`);
    }
    const legacyLibPath = path.join(LEGACY_HOOKS_DIR, 'lib', libFile);
    if (deleteFile(legacyLibPath)) {
      log(`Removed lib (legacy): ${libFile}`);
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

  // Check hooks (both new and legacy paths)
  let hooksInstalled = 0;
  let hooksTotal = 0;
  for (const [hookType, files] of Object.entries(HOOKS)) {
    for (const file of files) {
      hooksTotal++;
      const newPath = path.join(HOOKS_DIR, hookType, file);
      const legacyPath = path.join(LEGACY_HOOKS_DIR, hookType, file);
      const exists = fileExists(newPath) || fileExists(legacyPath);
      const status = exists ? '  Installed' : '  Not installed';
      if (exists) hooksInstalled++;
      console.log(`  ${hookType}/${file}: ${status}`);
    }
  }

  // Check rules (both new and legacy paths)
  let rulesInstalled = 0;
  for (const rule of RULES) {
    const newPath = path.join(RULES_DIR, rule);
    const legacyPath = path.join(LEGACY_RULES_DIR, rule);
    const exists = fileExists(newPath) || fileExists(legacyPath);
    const status = exists ? '  Installed' : '  Not installed';
    if (exists) rulesInstalled++;
    console.log(`  rules/${rule}: ${status}`);
  }

  // Check shared library (both paths)
  const libInNewPath = SHARED_LIB.every(f =>
    fileExists(path.join(HOOKS_DIR, 'lib', f))
  );
  const libInLegacy = SHARED_LIB.every(f =>
    fileExists(path.join(LEGACY_HOOKS_DIR, 'lib', f))
  );
  const libExists = libInNewPath || libInLegacy;
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
function main() {
  const command = process.argv[2];

  // Commands that need validation
  const needsValidation = ['install', 'uninstall', 'status'];

  if (needsValidation.includes(command)) {
    const validation = validateEnvironment();
    if (!validation.valid) {
      error(validation.error);
      process.exit(1);
    }
  }

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

Standalone package - installs claude-hooks-core automatically.
`);
  }
}

try {
  main();
} catch (err) {
  error(err.message);
  process.exit(1);
}
