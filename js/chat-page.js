// ================================================================
//  DRAW TOGETHER — chat-page.js
//  Standalone lobby + text chat room page
// ================================================================

let db = null;
let myUserId = null;
let myName = null;

let groupsRef = null;
let groupsListener = null;

let currentGroupId = null;
let currentGroupRef = null;
let myMemberKey = null;
let messagesListener = null;
let membersListener = null;

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
  alert(msg);
}

function fmtTime(ts) {
  const d = new Date(ts || Date.now());
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return hh + ':' + mm;
}

function showLobby() {
  document.getElementById('chat-lobby-view').classList.remove('hidden');
  document.getElementById('chat-room-view').classList.add('hidden');
  currentGroupId = null;
  currentGroupRef = null;
  myMemberKey = null;
  detachRoomListeners();
  window.history.replaceState({}, '', 'chat.html');
}

function showRoom() {
  document.getElementById('chat-lobby-view').classList.add('hidden');
  document.getElementById('chat-room-view').classList.remove('hidden');
}

function updateNameDisplay() {
  document.getElementById('player-name-display').textContent = myName || '?';
}

function promptForName() {
  const val = prompt('Enter your player name (max 20 chars):');
  if (!val || !val.trim()) {
    promptForName();
    return;
  }
  myName = val.trim().slice(0, 20);
  localStorage.setItem('dt_chat_name', myName);
  updateNameDisplay();
}

function init() {
  try {
    db = firebase.database();
  } catch (e) {
    console.error('Firebase not ready:', e);
    document.getElementById('groups-list').innerHTML = '<p class="chat-empty-state">Firebase not configured</p>';
    return;
  }

  myUserId = getMyUserId();

  const savedName = localStorage.getItem('dt_chat_name');
  if (savedName) {
    myName = savedName;
  } else {
    promptForName();
  }
  updateNameDisplay();

  bindEvents();
  startGroupsListener();

  const params = new URLSearchParams(window.location.search);
  const groupId = params.get('chat');
  if (groupId) {
    enterRoom(groupId);
  } else {
    showLobby();
  }
}

function bindEvents() {
  document.getElementById('back-btn').addEventListener('click', () => {
    if (currentGroupId) {
      leaveRoom().finally(() => {
        window.location.href = 'index.html';
      });
      return;
    }
    window.location.href = 'index.html';
  });

  document.getElementById('change-name-btn').addEventListener('click', () => {
    localStorage.removeItem('dt_chat_name');
    promptForName();
    updateNameDisplay();
  });

  document.getElementById('create-group-btn').addEventListener('click', openCreateModal);
  document.getElementById('create-cancel').addEventListener('click', closeCreateModal);
  document.getElementById('create-confirm').addEventListener('click', handleCreateGroup);

  const slider = document.getElementById('max-members');
  const valSpan = document.getElementById('max-members-value');
  slider.addEventListener('input', () => {
    valSpan.textContent = slider.value;
  });

  document.getElementById('group-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleCreateGroup();
  });

  document.getElementById('room-back-btn').addEventListener('click', () => {
    leaveRoom().finally(() => {
      showLobby();
    });
  });

  document.getElementById('room-send-btn').addEventListener('click', sendMessage);
  document.getElementById('room-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

function startGroupsListener() {
  groupsRef = db.ref('chat_groups');
  groupsListener = groupsRef.on('value', snap => {
    renderGroups(snap.val() || {});
  });
}

function renderGroups(groups) {
  const listEl = document.getElementById('groups-list');
  const ids = Object.keys(groups);

  if (ids.length === 0) {
    listEl.innerHTML = '<p class="chat-empty-state">No groups yet. Create one!</p>';
    return;
  }

  listEl.innerHTML = '';

  ids.forEach(groupId => {
    const group = groups[groupId];
    const members = group.members || {};
    const memberCount = Object.keys(members).length;
    const max = group.maxMembers || 10;
    const msgCount = group.messages ? Object.keys(group.messages).length : 0;
    const isFull = memberCount >= max;

    const card = document.createElement('div');
    card.className = 'chat-group-item';

    card.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:12px;">
        <div style="flex:1;">
          <div class="chat-group-name">${group.ownerId === myUserId ? '👑' : ''}${escHtml(group.name || 'Unnamed')}</div>
          <div class="chat-group-meta">
            <span>👥 ${memberCount}/${max}</span>
            <span>💬 ${msgCount} messages</span>
          </div>
        </div>
        <button class="join-group-btn" data-gid="${groupId}" ${isFull ? 'disabled' : ''}
          style="margin-left:auto;padding:6px 12px;background:${isFull ? 'transparent' : 'var(--accent-glow)'};border:1px solid ${isFull ? 'var(--border)' : 'var(--accent)'};color:${isFull ? 'var(--text-muted)' : 'var(--accent)'};border-radius:99px;font-weight:700;cursor:${isFull ? 'not-allowed' : 'pointer'};font-size:0.85rem;">
          ${isFull ? 'Full' : 'Join Group'}
        </button>
      </div>
    `;

    listEl.appendChild(card);
  });

  listEl.querySelectorAll('.join-group-btn').forEach(btn => {
    if (btn.disabled) return;
    btn.addEventListener('click', () => {
      enterRoom(btn.dataset.gid);
    });
  });
}

function openCreateModal() {
  document.getElementById('create-modal').classList.add('visible');
  document.getElementById('group-name').focus();
}

function closeCreateModal() {
  document.getElementById('create-modal').classList.remove('visible');
  document.getElementById('create-form').reset();
  document.getElementById('max-members-value').textContent = '10';
  const err = document.getElementById('create-error');
  err.classList.remove('show');
  err.textContent = '';
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

  const newGroupRef = db.ref('chat_groups').push();
  const groupId = newGroupRef.key;
  const memberKey = db.ref('chat_groups/' + groupId + '/members').push().key;

  newGroupRef.set({
    id: groupId,
    name,
    ownerId: myUserId,
    maxMembers,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    members: {
      [memberKey]: {
        uid: myUserId,
        name: myName,
        joinedAt: firebase.database.ServerValue.TIMESTAMP
      }
    }
  }).then(() => {
    closeCreateModal();
    enterRoom(groupId, memberKey);
  }).catch(err => {
    console.error('Create error:', err);
    errorEl.textContent = 'Failed to create group: ' + err.message;
    errorEl.classList.add('show');
  });
}

function enterRoom(groupId, knownMemberKey) {
  const groupRef = db.ref('chat_groups/' + groupId);

  groupRef.once('value').then(snap => {
    const group = snap.val();
    if (!group) {
      showToast('This group no longer exists.');
      showLobby();
      return;
    }

    const members = group.members || {};
    const memberEntries = Object.entries(members);
    const existing = memberEntries.find(([, m]) => m.uid === myUserId);

    if (existing) {
      myMemberKey = existing[0];
      openRoom(groupId, group.name || 'Group Chat');
      return;
    }

    const max = group.maxMembers || 10;
    if (memberEntries.length >= max) {
      showToast('Group is full.');
      return;
    }

    const newMemberKey = knownMemberKey || groupRef.child('members').push().key;

    groupRef.child('members/' + newMemberKey).set({
      uid: myUserId,
      name: myName,
      joinedAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
      myMemberKey = newMemberKey;
      groupRef.child('messages').push({
        type: 'system',
        text: myName + ' joined the chat',
        timestamp: firebase.database.ServerValue.TIMESTAMP
      });
      openRoom(groupId, group.name || 'Group Chat');
    }).catch(err => {
      console.error('Join error:', err);
      showToast('Failed to join group.');
    });
  }).catch(err => {
    console.error('Enter room error:', err);
    showToast('Could not open this group.');
  });
}

function openRoom(groupId, title) {
  currentGroupId = groupId;
  currentGroupRef = db.ref('chat_groups/' + groupId);

  showRoom();
  document.getElementById('room-title').textContent = title;
  document.getElementById('room-input').value = '';
  document.getElementById('room-messages').innerHTML = '';

  window.history.replaceState({}, '', 'chat.html?chat=' + groupId);

  detachRoomListeners();

  const membersRef = currentGroupRef.child('members');
  membersListener = membersRef.on('value', snap => {
    const members = snap.val() || {};
    const count = Object.keys(members).length;
    document.getElementById('room-members').textContent = count + ' online';

    if (myMemberKey && !members[myMemberKey]) {
      showToast('You were removed from this group.');
      showLobby();
      return;
    }

    if (count === 0) {
      showLobby();
    }
  });

  const messagesRef = currentGroupRef.child('messages');
  messagesListener = messagesRef.limitToLast(200).on('value', snap => {
    renderMessages(snap.val() || {});
  });
}

function renderMessages(messagesObj) {
  const container = document.getElementById('room-messages');
  const sorted = Object.values(messagesObj).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  const atBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 40;

  container.innerHTML = '';

  sorted.forEach(msg => {
    const row = document.createElement('div');

    if (msg.type === 'system') {
      row.className = 'chat-room-system';
      row.textContent = msg.text || '';
      container.appendChild(row);
      return;
    }

    const isMe = msg.uid === myUserId;
    row.className = 'chat-room-msg ' + (isMe ? 'me' : 'them');

    const safeName = escHtml(msg.name || '?');
    const safeText = escHtml(msg.text || '');
    const time = fmtTime(msg.timestamp || Date.now());

    row.innerHTML = `
      <div class="chat-room-bubble">
        ${isMe ? '' : `<span class="chat-room-name">${safeName}</span>`}
        <p class="chat-room-text">${safeText}</p>
        <span class="chat-room-time">${time}</span>
      </div>
    `;

    container.appendChild(row);
  });

  if (atBottom) {
    container.scrollTop = container.scrollHeight;
  }
}

function sendMessage() {
  if (!currentGroupRef || !myMemberKey) return;

  const input = document.getElementById('room-input');
  const text = input.value.trim();
  if (!text) return;
  if (text.length > 500) return;

  const sendBtn = document.getElementById('room-send-btn');
  sendBtn.disabled = true;

  currentGroupRef.child('messages').push({
    type: 'user',
    uid: myUserId,
    name: myName,
    text,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  }).then(() => {
    input.value = '';
  }).catch(err => {
    console.error('Send message failed:', err);
    showToast('Failed to send message.');
  }).finally(() => {
    sendBtn.disabled = false;
  });
}

function leaveRoom() {
  if (!currentGroupRef || !myMemberKey) {
    detachRoomListeners();
    return Promise.resolve();
  }

  const ref = currentGroupRef;
  const memberKey = myMemberKey;

  return ref.child('messages').push({
    type: 'system',
    text: myName + ' left the chat',
    timestamp: firebase.database.ServerValue.TIMESTAMP
  }).catch(() => {
    // Ignore system message errors and still attempt member removal.
  }).then(() => {
    return ref.child('members/' + memberKey).remove();
  }).catch(err => {
    console.error('Leave room failed:', err);
  }).finally(() => {
    detachRoomListeners();
    currentGroupId = null;
    currentGroupRef = null;
    myMemberKey = null;
  });
}

function detachRoomListeners() {
  if (currentGroupRef && membersListener) {
    currentGroupRef.child('members').off('value', membersListener);
  }
  if (currentGroupRef && messagesListener) {
    currentGroupRef.child('messages').off('value', messagesListener);
  }
  membersListener = null;
  messagesListener = null;
}

window.addEventListener('beforeunload', () => {
  if (currentGroupRef && myMemberKey) {
    currentGroupRef.child('members/' + myMemberKey).remove();
  }
});

window.addEventListener('load', init);
