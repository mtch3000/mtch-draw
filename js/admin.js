// ================================================================
//  DRAW TOGETHER — admin.js
//  Handles admin login (client-side) and the Clear Canvas action.
// ================================================================
//
//  ⚠️  HOW ADMIN LOGIN WORKS  ⚠️
//
//  The username and password live in js/config.js (ADMIN_CREDENTIALS).
//  This is a simple client-side check — it is NOT a fully secure
//  server-side auth system.  It is fine for a casual collaborative
//  drawing app where "admin" just means "can clear the canvas."
//
//  DO NOT store financial data or sensitive personal information
//  in this project.
//
// ================================================================


// ── DOM ELEMENT REFERENCES ────────────────────────────────────────

const loginCard    = document.getElementById('login-card');
const adminPanel   = document.getElementById('admin-panel');
const loginBtn     = document.getElementById('login-btn');
const logoutBtn    = document.getElementById('logout-btn');
const clearBtn     = document.getElementById('clear-btn');
const usernameInput = document.getElementById('username-input');
const passwordInput = document.getElementById('password-input');
const loginError   = document.getElementById('login-error');
const strokeCount  = document.getElementById('stroke-count');
const clearMsg     = document.getElementById('clear-msg');
const lastClearedText = document.getElementById('last-cleared-text');

// ── SESSION KEY ───────────────────────────────────────────────────
//
//   We store a simple flag in sessionStorage so the admin stays
//   "logged in" if they refresh the page (but NOT across tabs or
//   browser restarts, which is intentional for security).
//
const SESSION_KEY = 'drawtogether_admin_session';


// ── SHOW / HIDE PANELS ─────────────────────────────────────────────

function showAdminPanel() {
  loginCard.style.display  = 'none';
  adminPanel.style.display = 'flex';
  startStrokeCounter();
  startChatMonitor();
}

function showLoginPanel() {
  adminPanel.style.display = 'none';
  loginCard.style.display  = 'flex';
  usernameInput.value = '';
  passwordInput.value = '';
  loginError.textContent  = '';
  stopChatMonitor();
}


// ── LOGIN LOGIC ───────────────────────────────────────────────────

function attemptLogin() {
  const user = usernameInput.value.trim();
  const pass = passwordInput.value;

  // ADMIN_CREDENTIALS is defined in js/config.js
  if (
    user === ADMIN_CREDENTIALS.username &&
    pass === ADMIN_CREDENTIALS.password
  ) {
    sessionStorage.setItem(SESSION_KEY, '1');
    loginError.textContent = '';
    showAdminPanel();
  } else {
    loginError.textContent = '❌ Incorrect username or password.';
    passwordInput.value = '';
    passwordInput.focus();
  }
}

// Allow pressing Enter in either field to trigger login
usernameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') passwordInput.focus();
});
passwordInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') attemptLogin();
});

loginBtn.addEventListener('click', attemptLogin);


// ── LOGOUT LOGIC ──────────────────────────────────────────────────

logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem(SESSION_KEY);
  stopStrokeCounter();
  stopChatMonitor();
  showLoginPanel();
});


// ── STROKE COUNTER (live) ─────────────────────────────────────────
//
//   While the admin panel is visible, we listen to the Firebase
//   'strokes' node and update the stroke count in real time.
//

let strokesRef      = null;
let strokeListener  = null;

function startStrokeCounter() {
  // Safety check: firebase must be ready
  try {
    strokesRef = firebase.database().ref('strokes');
  } catch (e) {
    strokeCount.textContent = '(Firebase not configured)';
    return;
  }

  strokeListener = strokesRef.on('value', snapshot => {
    const data = snapshot.val();
    const count = data ? Object.keys(data).length : 0;
    strokeCount.textContent = count;
  });
}

function stopStrokeCounter() {
  if (strokesRef && strokeListener) {
    strokesRef.off('value', strokeListener);
  }
  strokesRef     = null;
  strokeListener = null;
}


// ── CLEAR CANVAS LOGIC ────────────────────────────────────────────
//
//   Clicking "Clear Entire Canvas" deletes ALL strokes from Firebase.
//   Because every connected browser listens for changes, they will
//   all automatically clear their canvas the moment this runs.
//

clearBtn.addEventListener('click', () => {
  // Ask for confirmation before wiping everything
  const confirmed = window.confirm(
    '⚠️  This will permanently erase ALL drawings for EVERYONE.\n\nAre you sure?'
  );
  if (!confirmed) return;

  clearBtn.disabled = true;
  clearBtn.textContent = '⏳  Clearing…';

  strokesRef.remove()
    .then(() => {
      clearBtn.disabled    = false;
      clearBtn.innerHTML   = '🗑️ &nbsp;Clear Entire Canvas';
      lastClearedText.style.display = 'block';

      // Show the success message for 4 seconds then hide it
      setTimeout(() => {
        lastClearedText.style.display = 'none';
      }, 4000);
    })
    .catch(err => {
      clearBtn.disabled  = false;
      clearBtn.innerHTML = '🗑️ &nbsp;Clear Entire Canvas';
      clearMsg.style.display   = 'block';
      clearMsg.style.color     = 'var(--danger)';
      clearMsg.textContent     = '❌ Error clearing canvas: ' + err.message;
    });
});


// ── CHAT MANAGEMENT ──────────────────────────────────────────────
//
//   Admin can view and delete chat groups in real time.
//

let chatGroupsRef   = null;
let chatListener    = null;

function startChatMonitor() {
  try {
    chatGroupsRef = firebase.database().ref('chat_groups');
  } catch (e) {
    document.getElementById('chat-groups-container').innerHTML = 
      '<p style="color: var(--danger);">Chat system not configured</p>';
    return;
  }

  chatListener = chatGroupsRef.on('value', snapshot => {
    const data = snapshot.val() || {};
    _renderChatGroups(data);
  });
}

function stopChatMonitor() {
  if (chatGroupsRef && chatListener) {
    chatGroupsRef.off('value', chatListener);
  }
  chatGroupsRef   = null;
  chatListener    = null;
}

function _renderChatGroups(groups) {
  const container = document.getElementById('chat-groups-container');
  const groupIds = Object.keys(groups);

  if (groupIds.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 12px;">No active chat groups</p>';
    return;
  }

  container.innerHTML = '';
  groupIds.forEach(groupId => {
    const group = groups[groupId];
    const members = group.members ? Object.keys(group.members).length : 0;
    const messages = group.messages ? Object.keys(group.messages).length : 0;

    const card = document.createElement('div');
    card.className = 'admin-chat-group-card';
    card.innerHTML = `
      <div style="flex: 1;">
        <div style="font-weight: 700; color: var(--text); margin-bottom: 4px;">
          ${_escAdminHtml(group.name || 'Unnamed Group')}
        </div>
        <div style="font-size: 0.82rem; color: var(--text-muted); display: flex; gap: 12px;">
          <span>👥 ${members} member${members !== 1 ? 's' : ''}</span>
          <span>💬 ${messages} message${messages !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <button class="btn-danger admin-delete-group-btn" data-group-id="${groupId}" 
              style="font-size: 0.75rem; padding: 6px 10px;">Delete</button>
    `;
    container.appendChild(card);
  });

  // Attach delete handlers
  container.querySelectorAll('.admin-delete-group-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const groupId = btn.dataset.groupId;
      const groupName = groups[groupId]?.name || 'Group';
      if (confirm(`Delete chat group "${_escAdminHtml(groupName)}"? This cannot be undone.`)) {
        chatGroupsRef.child(groupId).remove()
          .catch(err => alert('Error deleting group: ' + err.message));
      }
    });
  });
}

function _escAdminHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── INIT: CHECK EXISTING SESSION ──────────────────────────────────
//
//   On page load, check whether the admin already has an active
//   session from a previous visit during the same browser session.
//

window.addEventListener('load', () => {
  if (sessionStorage.getItem(SESSION_KEY) === '1') {
    showAdminPanel();
  } else {
    showLoginPanel();
    // Auto-focus the username field for convenience
    usernameInput.focus();
  }
});
