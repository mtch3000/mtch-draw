// ================================================================
//  DRAW TOGETHER — chat-page.js
//  Standalone chat page for managing groups
// ================================================================

let db = null;
let myUserId = null;
let myName = null;
let groupsRef = null;
let groupsListener = null;

// ── HELPERS ─────────────────────────────────────────────────────
function getMyUserId() {
  let uid = localStorage.getItem('drawtogether_uid');
  if (!uid) {
    uid = 'u_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now();
    localStorage.setItem('drawtogether_uid', uid);
  }
  return uid;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg) {
  // Simple toast (can be enhanced)
  alert(msg);
}

// ── INIT ────────────────────────────────────────────────────────
function init() {
  // Check Firebase
  try {
    db = firebase.database();
  } catch (e) {
    console.error('Firebase not ready:', e);
    document.getElementById('groups-list').innerHTML = 
      '<p class="chat-empty-state">❌ Firebase not configured</p>';
    return;
  }

  myUserId = getMyUserId();

  // Load saved name or prompt
  const saved = localStorage.getItem('dt_chat_name');
  if (saved) {
    myName = saved;
    updateNameDisplay();
    loadGroups();
  } else {
    promptForName();
  }

  // Setup event listeners
  document.getElementById('back-btn').addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  document.getElementById('change-name-btn').addEventListener('click', () => {
    localStorage.removeItem('dt_chat_name');
    myName = null;
    promptForName();
  });

  document.getElementById('create-group-btn').addEventListener('click', openCreateModal);
  document.getElementById('create-cancel').addEventListener('click', closeCreateModal);
  document.getElementById('create-confirm').addEventListener('click', handleCreateGroup);

  // Max members slider
  const slider = document.getElementById('max-members');
  const valSpan = document.getElementById('max-members-value');
  slider.addEventListener('input', () => {
    valSpan.textContent = slider.value;
  });

  // Enter key in group name
  document.getElementById('group-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleCreateGroup();
  });
}

// ── NAME PROMPT ─────────────────────────────────────────────────
function promptForName() {
  const name = prompt('Enter your player name (max 20 chars):');
  if (!name || !name.trim()) {
    promptForName();
    return;
  }

  myName = name.trim().slice(0, 20);
  localStorage.setItem('dt_chat_name', myName);
  updateNameDisplay();
  loadGroups();
}

function updateNameDisplay() {
  document.getElementById('player-name-display').textContent = myName || '?';
}

// ── LOAD GROUPS ─────────────────────────────────────────────────
function loadGroups() {
  groupsRef = db.ref('chat_groups');

  groupsListener = groupsRef.on('value', snapshot => {
    const groups = snapshot.val() || {};
    renderGroups(groups);
  });
}

function renderGroups(groups) {
  const groupsList = document.getElementById('groups-list');
  const groupIds = Object.keys(groups);

  if (groupIds.length === 0) {
    groupsList.innerHTML = '<p class="chat-empty-state">No groups yet. Create one!</p>';
    return;
  }

  groupsList.innerHTML = '';
  groupIds.forEach(groupId => {
    const group = groups[groupId];
    const members = group.members ? Object.keys(group.members).length : 0;
    const messages = group.messages ? Object.keys(group.messages).length : 0;
    const isFull = members >= (group.maxMembers || 10);

    const card = document.createElement('div');
    card.className = 'chat-group-item' + (isFull ? ' disabled' : '');

    let joinBtn = '';
    if (!isFull) {
      joinBtn = `<button class="join-group-btn" data-group-id="${groupId}" 
                   style="margin-left: auto; padding: 6px 12px; background: var(--accent-glow); 
                   border: 1px solid var(--accent); color: var(--accent); border-radius: 99px; 
                   font-weight: 700; cursor: pointer; font-size: 0.85rem;">
                   Join Group
                 </button>`;
    } else {
      joinBtn = `<span style="margin-left: auto; color: var(--danger); font-size: 0.85rem; font-weight: 700;">
                   GROUP FULL
                 </span>`;
    }

    card.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <div style="flex: 1;">
          <div class="chat-group-name">
            ${group.ownerId === myUserId ? '👑' : ''}
            ${escHtml(group.name || 'Unnamed')}
          </div>
          <div class="chat-group-meta">
            <span>👥 ${members}/${group.maxMembers || 10}</span>
            <span>💬 ${messages} message${messages !== 1 ? 's' : ''}</span>
          </div>
        </div>
        ${joinBtn}
      </div>
    `;

    groupsList.appendChild(card);
  });

  // Attach join handlers
  groupsList.querySelectorAll('.join-group-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const groupId = btn.dataset.groupId;
      const groupName = groups[groupId]?.name || 'Group';
      joinGroup(groupId, groupName);
    });
  });
}

function joinGroup(groupId, groupName) {
  const persistId = myUserId;
  const groupRef = db.ref(`chat_groups/${groupId}`);

  // Check if already in group
  groupRef.child('members').once('value', snapshot => {
    const members = snapshot.val() || {};
    
    // Check if user already in group
    let existingMemberId = null;
    for (const [memberId, member] of Object.entries(members)) {
      if (member.uid === persistId) {
        existingMemberId = memberId;
        break;
      }
    }

    if (existingMemberId) {
      // Already member, redirect to room
      window.location.href = `index.html?chat=${groupId}`;
      return;
    }

    // Check if group is full
    if (Object.keys(members).length >= 10) {
      showToast('❌ This group is full');
      return;
    }

    // Add as member
    const newMemberRef = groupRef.child('members').push();
    newMemberRef.set({
      uid: persistId,
      name: myName,
      joinedAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
      // Post system message
      groupRef.child('messages').push({
        type: 'system',
        text: `${escHtml(myName)} joined the group`,
        timestamp: firebase.database.ServerValue.TIMESTAMP
      });

      // Redirect to group
      window.location.href = `index.html?chat=${groupId}`;
    }).catch(err => {
      console.error('Join error:', err);
      showToast('❌ Failed to join group');
    });
  });
}

// ── CREATE GROUP MODAL ──────────────────────────────────────────
function openCreateModal() {
  document.getElementById('create-modal').classList.add('visible');
  document.getElementById('group-name').focus();
}

function closeCreateModal() {
  document.getElementById('create-modal').classList.remove('visible');
  document.getElementById('create-form').reset();
  document.getElementById('create-error').classList.remove('show');
}

function handleCreateGroup() {
  const name = document.getElementById('group-name').value.trim();
  const maxMembers = parseInt(document.getElementById('max-members').value, 10);
  const errorEl = document.getElementById('create-error');

  if (!name) {
    errorEl.textContent = 'Group name is required';
    errorEl.classList.add('show');
    return;
  }

  if (name.length > 30) {
    errorEl.textContent = 'Group name too long (max 30)';
    errorEl.classList.add('show');
    return;
  }

  const groupsRef = db.ref('chat_groups');
  const newGroupRef = groupsRef.push();
  const groupId = newGroupRef.key;

  newGroupRef.set({
    id: groupId,
    name: name,
    ownerId: myUserId,
    maxMembers: maxMembers,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    members: {
      [newGroupRef.child('members').push().key]: {
        uid: myUserId,
        name: myName,
        joinedAt: firebase.database.ServerValue.TIMESTAMP
      }
    }
  }).then(() => {
    closeCreateModal();
    showToast('✅ Group created!');
    
    // Optionally redirect to the new group
    setTimeout(() => {
      window.location.href = `index.html?chat=${groupId}`;
    }, 500);
  }).catch(err => {
    console.error('Create error:', err);
    errorEl.textContent = 'Failed to create group: ' + err.message;
    errorEl.classList.add('show');
  });
}

// ── START ───────────────────────────────────────────────────────
window.addEventListener('load', init);
