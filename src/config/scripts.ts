import type { EditorType } from './schema.js';

/**
 * Tmux open script - auto-detects terminal and creates tmux session
 * Uses WORKTREE_PATH and WORKTREE_NAME environment variables
 */
const TMUX_OPEN_SCRIPT = `#!/bin/bash
# wtcc open script - Terminal (tmux)
# Environment variables:
#   WORKTREE_PATH - full path to worktree
#   WORKTREE_NAME - sanitized name
#   BRANCH_NAME   - original branch name

SESSION_NAME="$WORKTREE_NAME"

# Detect iTerm (works even inside tmux via ITERM_SESSION_ID)
if [ -n "$ITERM_SESSION_ID" ]; then
    osascript <<EOF
tell application "iTerm"
    create window with default profile
    tell current session of current window
        write text "cd '$WORKTREE_PATH' && tmux new-session -s '$SESSION_NAME' || tmux attach -t '$SESSION_NAME'"
    end tell
end tell
EOF
elif [ "$TERM_PROGRAM" = "Apple_Terminal" ]; then
    osascript <<EOF
tell application "Terminal"
    do script "cd '$WORKTREE_PATH' && tmux new-session -s '$SESSION_NAME' || tmux attach -t '$SESSION_NAME'"
    activate
end tell
EOF
else
    echo "cd $WORKTREE_PATH && tmux new-session -s $SESSION_NAME"
fi
`;

/**
 * Tmux close script - kills tmux session and optionally closes terminal window
 * Uses WORKTREE_NAME environment variable
 */
const TMUX_CLOSE_SCRIPT = `#!/bin/bash
# wtcc close script - Terminal (tmux)
# Kill tmux session and close terminal window

tmux kill-session -t "$WORKTREE_NAME" 2>/dev/null

# Close iTerm/Terminal window running this session
if [ "$TERM_PROGRAM" = "iTerm.app" ]; then
    osascript -e "tell application \\"iTerm\\" to close (every window whose name contains \\"$WORKTREE_NAME\\")" 2>/dev/null
elif [ "$TERM_PROGRAM" = "Apple_Terminal" ]; then
    osascript -e "tell application \\"Terminal\\" to close (every window whose name contains \\"$WORKTREE_NAME\\")" 2>/dev/null
fi
`;

/**
 * Cursor open script - opens Cursor editor at worktree path
 * Uses WORKTREE_PATH environment variable
 */
const CURSOR_OPEN_SCRIPT = `#!/bin/bash
set -e

cursor "$WORKTREE_PATH"
`;

/**
 * Cursor close script - closes Cursor window via AppleScript
 * Uses WORKTREE_PATH environment variable
 */
const CURSOR_CLOSE_SCRIPT = `#!/bin/bash
set -e

# Close Cursor window for this worktree via AppleScript
osascript <<EOF
tell application "Cursor"
  set worktreePath to "$WORKTREE_PATH"
  repeat with w in windows
    try
      if name of w contains "$WORKTREE_NAME" then
        close w
      end if
    end try
  end repeat
end tell
EOF
`;

/**
 * Windsurf open script - opens Windsurf editor at worktree path
 * Uses WORKTREE_PATH environment variable
 */
const WINDSURF_OPEN_SCRIPT = `#!/bin/bash
set -e

windsurf "$WORKTREE_PATH"
`;

/**
 * Windsurf close script - closes Windsurf window via AppleScript
 * Uses WORKTREE_PATH and WORKTREE_NAME environment variables
 */
const WINDSURF_CLOSE_SCRIPT = `#!/bin/bash
set -e

# Close Windsurf window for this worktree via AppleScript
osascript <<EOF
tell application "Windsurf"
  set worktreePath to "$WORKTREE_PATH"
  repeat with w in windows
    try
      if name of w contains "$WORKTREE_NAME" then
        close w
      end if
    end try
  end repeat
end tell
EOF
`;

/**
 * VS Code open script - opens VS Code at worktree path
 * Uses WORKTREE_PATH environment variable
 */
const VSCODE_OPEN_SCRIPT = `#!/bin/bash
set -e

code "$WORKTREE_PATH"
`;

/**
 * Terminal App open script - opens Project Terminal with project name and path
 * Uses WORKTREE_PATH and WORKTREE_NAME environment variables
 */
const TERMINAL_APP_OPEN_SCRIPT = `#!/bin/bash
# wtcc open script - Project Terminal
# Environment variables:
#   WORKTREE_PATH - full path to worktree
#   WORKTREE_NAME - sanitized name
#   BRANCH_NAME   - original branch name

# Find Project Terminal app bundle and run binary directly
# (open -a reorders args, breaking Electron's argv parsing)
APP_BUNDLE=$(mdfind "kMDItemFSName == 'Project Terminal.app'" 2>/dev/null | head -1)

if [ -z "$APP_BUNDLE" ]; then
  echo "Error: Project Terminal app not found"
  exit 1
fi

APP="$APP_BUNDLE/Contents/MacOS/Project Terminal"
nohup "$APP" "--project-name=$WORKTREE_NAME" "--project-path=$WORKTREE_PATH" > /dev/null 2>&1 &
sleep 1
open -a "Project Terminal"
`;

/**
 * Terminal App close script - closes Project Terminal project
 * Uses WORKTREE_NAME environment variable
 */
const TERMINAL_APP_CLOSE_SCRIPT = `#!/bin/bash
# wtcc close script - Project Terminal
# No-op: Project Terminal manages its own sessions
`;

/**
 * VsCodeSwitch open script - adds project to VsCodeSwitch app and opens it
 * Uses WORKTREE_PATH and WORKTREE_NAME environment variables
 */
const VSCODE_SWITCH_OPEN_SCRIPT = `#!/bin/bash
# wtcc open script - VsCodeSwitch
# Environment variables:
#   WORKTREE_PATH - full path to worktree
#   WORKTREE_NAME - sanitized name
#   BRANCH_NAME   - original branch name

PROJECTS_FILE="$HOME/Library/Application Support/vscode-switch/projects.json"

# Ensure projects directory exists
mkdir -p "$(dirname "$PROJECTS_FILE")"

# Add project to projects.json
python3 -c "
import json, uuid, os
path = '$PROJECTS_FILE'
if os.path.exists(path):
    data = json.load(open(path))
else:
    data = {'projects': [], 'lastActiveProjectId': None}
existing = next((p for p in data['projects'] if p['path'] == '$WORKTREE_PATH'), None)
if existing:
    data['lastActiveProjectId'] = existing['id']
else:
    new_id = str(uuid.uuid4())
    data['projects'].append({'id': new_id, 'name': '$WORKTREE_NAME', 'path': '$WORKTREE_PATH'})
    data['lastActiveProjectId'] = new_id
json.dump(data, open(path, 'w'), indent=2)
"

# Quit VsCodeSwitch if running, then reopen so it loads the new project
osascript -e 'tell application "VsCodeSwitch" to quit' 2>/dev/null
sleep 1
open -a VsCodeSwitch

# Also open Project Terminal
TERMINAL_APP="\${PROJECT_TERMINAL_APP:-}"
if [ -z "$TERMINAL_APP" ]; then
  if [ -d "/Applications/Project Terminal.app" ]; then
    TERMINAL_APP="/Applications/Project Terminal.app/Contents/MacOS/Project Terminal"
  else
    TERMINAL_APP=$(mdfind 'kMDItemCFBundleIdentifier == "com.minhtran.project-terminal"' 2>/dev/null | grep -m1 '/Applications/' || mdfind 'kMDItemCFBundleIdentifier == "com.minhtran.project-terminal"' 2>/dev/null | head -1)
    if [ -n "$TERMINAL_APP" ]; then
      TERMINAL_APP="$TERMINAL_APP/Contents/MacOS/Project Terminal"
    fi
  fi
fi
if [ -n "$TERMINAL_APP" ] && [ -f "$TERMINAL_APP" ]; then
  "$TERMINAL_APP" "--project-name=$WORKTREE_NAME" "--project-path=$WORKTREE_PATH" &
  disown
fi
`;

/**
 * VsCodeSwitch close script - removes project from VsCodeSwitch app
 * Uses WORKTREE_PATH environment variable
 */
const VSCODE_SWITCH_CLOSE_SCRIPT = `#!/bin/bash
# wtcc close script - VsCodeSwitch
# Remove project from VsCodeSwitch projects list

PROJECTS_FILE="$HOME/Library/Application Support/vscode-switch/projects.json"

if [ -f "$PROJECTS_FILE" ]; then
  python3 -c "
import sys, json
data = json.load(open('$PROJECTS_FILE'))
data['projects'] = [p for p in data.get('projects', []) if p.get('path') != '$WORKTREE_PATH']
if data.get('lastActiveProjectId'):
    ids = [p['id'] for p in data['projects']]
    if data['lastActiveProjectId'] not in ids:
        data['lastActiveProjectId'] = ids[0] if ids else None
json.dump(data, open('$PROJECTS_FILE', 'w'), indent=2)
"
fi
`;

/**
 * VS Code close script - closes VS Code window via AppleScript
 * Uses WORKTREE_PATH and WORKTREE_NAME environment variables
 */
const VSCODE_CLOSE_SCRIPT = `#!/bin/bash
set -e

# Close VS Code window for this worktree via AppleScript
osascript <<EOF
tell application "Visual Studio Code"
  set worktreePath to "$WORKTREE_PATH"
  repeat with w in windows
    try
      if name of w contains "$WORKTREE_NAME" then
        close w
      end if
    end try
  end repeat
end tell
EOF
`;

/**
 * Map of editor types to their open scripts
 */
const OPEN_SCRIPTS: Record<EditorType, string | null> = {
  tmux: TMUX_OPEN_SCRIPT,
  cursor: CURSOR_OPEN_SCRIPT,
  windsurf: WINDSURF_OPEN_SCRIPT,
  vscode: VSCODE_OPEN_SCRIPT,
  'vscode-switch': VSCODE_SWITCH_OPEN_SCRIPT,
  'terminal-app': TERMINAL_APP_OPEN_SCRIPT,
  none: null,
};

/**
 * Map of editor types to their close scripts
 */
const CLOSE_SCRIPTS: Record<EditorType, string | null> = {
  tmux: TMUX_CLOSE_SCRIPT,
  cursor: CURSOR_CLOSE_SCRIPT,
  windsurf: WINDSURF_CLOSE_SCRIPT,
  vscode: VSCODE_CLOSE_SCRIPT,
  'vscode-switch': VSCODE_SWITCH_CLOSE_SCRIPT,
  'terminal-app': TERMINAL_APP_CLOSE_SCRIPT,
  none: null,
};

/**
 * Get the open script template for an editor type
 * @param editor - The editor type
 * @returns The script template or null if no script for that editor
 */
export function getOpenScript(editor: EditorType): string | null {
  return OPEN_SCRIPTS[editor];
}

/**
 * Get the close script template for an editor type
 * @param editor - The editor type
 * @returns The script template or null if no script for that editor
 */
export function getCloseScript(editor: EditorType): string | null {
  return CLOSE_SCRIPTS[editor];
}

// Export script constants for direct access if needed
export {
  TMUX_OPEN_SCRIPT,
  TMUX_CLOSE_SCRIPT,
  CURSOR_OPEN_SCRIPT,
  CURSOR_CLOSE_SCRIPT,
  WINDSURF_OPEN_SCRIPT,
  WINDSURF_CLOSE_SCRIPT,
  VSCODE_OPEN_SCRIPT,
  VSCODE_CLOSE_SCRIPT,
  VSCODE_SWITCH_OPEN_SCRIPT,
  VSCODE_SWITCH_CLOSE_SCRIPT,
  TERMINAL_APP_OPEN_SCRIPT,
  TERMINAL_APP_CLOSE_SCRIPT,
  OPEN_SCRIPTS,
  CLOSE_SCRIPTS,
};
