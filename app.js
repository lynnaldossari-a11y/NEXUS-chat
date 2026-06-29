const supabaseUrl = 'https://srlfmbtnhbwzxppgwktl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNybGZtYnRuaGJ3enhwcGd3a3RsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MzcyNDksImV4cCI6MjA5ODMxMzI0OX0.vSXksdAuLq4mLyX9EpWz8lSqww-u6TVvqwQohbr8ZHM';
const db = supabase.createClient(supabaseUrl, supabaseKey);

let sessionUser = null;
let currentRoom = 'global';
let activeSub = null;
let mediaRecorder = null;
let recordedChunks = [];
let userProfiles = {};
let isRecording = false;
let stickers = [];
let stickerPanelOpen = false;
let friends = [];
let currentTheme = 'dark';

function escapeHtml(text = '') {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getAvatarUrl(username) {
    return userProfiles[username]?.pfp_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=7F77DD&color=fff`;
}

function applyTheme(theme) {
    currentTheme = theme || 'dark';
    document.body.setAttribute('data-theme', currentTheme);
    localStorage.setItem('nexus-theme', currentTheme);
    const themePicker = document.getElementById('theme-picker');
    if (themePicker) themePicker.value = currentTheme;
    const profileTheme = document.getElementById('profile-theme');
    if (profileTheme) profileTheme.value = currentTheme;
}

function changeTheme(theme) {
    applyTheme(theme);
    if (sessionUser && userProfiles[sessionUser]) {
        userProfiles[sessionUser] = { ...userProfiles[sessionUser], theme: currentTheme };
    }
}

async function showError(msg) {
    const el = document.getElementById('auth-error');
    if (!el) return;
    el.innerText = msg;
    setTimeout(() => { if (el) el.innerText = ''; }, 5000);
}

function initApp() {
    applyTheme(localStorage.getItem('nexus-theme') || 'dark');
    if (document.getElementById('auth-container')) {
        document.getElementById('chat-interface').style.display = 'none';
    }
    setupUIBindings();
}

function setupUIBindings() {
    const mediaInput = document.getElementById('media-upload');
    if (mediaInput) {
        mediaInput.addEventListener('change', (event) => {
            const file = event.target.files?.[0];
            if (file) handleMediaPicker(file);
            event.target.value = '';
        });
    }
    const stickerInput = document.getElementById('sticker-file');
    if (stickerInput) {
        stickerInput.addEventListener('change', (event) => {
            const file = event.target.files?.[0];
            if (file) handleStickerFileSelection(file);
            event.target.value = '';
        });
    }
}

function canModerate() {
    const prof = userProfiles[sessionUser];
    return !!(prof?.is_admin || prof?.is_owner);
}

async function canSendMessage() {
    if (!sessionUser) return false;
    const { data: ban } = await db.from('banned_users').select('*').eq('banned_username', sessionUser).maybeSingle();
    if (ban && (!ban.expires_at || new Date(ban.expires_at) > new Date())) {
        showError('You are currently banned from sending messages.');
        return false;
    }
    const { data: mute } = await db.from('muted_users').select('*').eq('muted_username', sessionUser).maybeSingle();
    if (mute && (!mute.muted_until || new Date(mute.muted_until) > new Date())) {
        showError('You are currently muted.');
        return false;
    }
    return true;
}

async function handleAuth() {
    try {
        const u = document.getElementById('username').value.trim();
        const p = document.getElementById('password').value.trim();

        if (!u || !p) {
            showError('Username and password required');
            return;
        }

        const { data: existing, error: lookupError } = await db.from('accounts').select('*').eq('username', u).maybeSingle();
        if (lookupError) throw lookupError;

        if (existing) {
            if (existing.password !== p) {
                showError('Invalid password');
                return;
            }
            sessionUser = u;
            userProfiles[u] = existing;
        } else {
            const { error } = await db.from('accounts').insert([{
                username: u,
                password: p,
                display_name: u,
                bio: '',
                pfp_url: getAvatarUrl(u),
                is_admin: false,
                is_owner: false,
                theme: currentTheme
            }]);
            if (error) throw error;
            sessionUser = u;
            userProfiles[u] = { username: u, display_name: u, bio: '', pfp_url: getAvatarUrl(u), is_admin: false, is_owner: false, theme: currentTheme };
        }

        if (userProfiles[u]?.theme) applyTheme(userProfiles[u].theme);

        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('chat-interface').style.display = 'flex';
        updateUserBadge();
        const prof = userProfiles[u];
        document.getElementById('admin-wipe').style.display = prof?.is_admin || prof?.is_owner ? 'block' : 'none';
        document.getElementById('admin-stickers').style.display = prof?.is_admin || prof?.is_owner ? 'block' : 'none';
        document.getElementById('mod-tools').style.display = prof?.is_admin || prof?.is_owner ? 'block' : 'none';
        loadFriends();
        loadStickers();
        switchRoom('global', 'Global Chat');
        setupGlobalListener();

        if (window.Notification && Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
    } catch (err) {
        showError('Auth error: ' + err.message);
    }
}

function logout() {
    if (confirm('Logout?')) {
        sessionUser = null;
        currentRoom = 'global';
        if (activeSub) db.removeChannel(activeSub);
        document.getElementById('auth-container').style.display = 'block';
        document.getElementById('chat-interface').style.display = 'none';
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        document.getElementById('msg-list').innerHTML = '';
    }
}

async function openProfileModal() {
    document.getElementById('profile-username').value = sessionUser;
    const prof = userProfiles[sessionUser];
    document.getElementById('profile-display-name').value = prof?.display_name || '';
    document.getElementById('profile-bio').value = prof?.bio || '';
    document.getElementById('profile-pfp-url').value = prof?.pfp_url || '';
    document.getElementById('profile-theme').value = prof?.theme || currentTheme;
    document.getElementById('profile-preview').style.display = 'none';
    document.getElementById('profile-modal').classList.add('active');
}

function closeProfileModal() {
    document.getElementById('profile-modal').classList.remove('active');
}

async function saveProfile() {
    try {
        const display_name = document.getElementById('profile-display-name').value.trim();
        const bio = document.getElementById('profile-bio').value.trim();
        let pfp_url = document.getElementById('profile-pfp-url').value.trim();
        const theme = document.getElementById('profile-theme').value;

        if (!display_name) {
            showError('Display name required');
            return;
        }

        if (!pfp_url) pfp_url = getAvatarUrl(sessionUser);

        const { error } = await db.from('accounts').update({ display_name, bio, pfp_url, theme }).eq('username', sessionUser);
        if (error) throw error;

        userProfiles[sessionUser] = { ...userProfiles[sessionUser], display_name, bio, pfp_url, theme };
        applyTheme(theme);
        updateUserBadge();
        closeProfileModal();
        document.getElementById('msg-list').innerHTML = '';
        loadMessages();
    } catch (err) {
        showError('Profile update failed: ' + err.message);
    }
}

function updateUserBadge() {
    const prof = userProfiles[sessionUser];
    document.getElementById('user-name-badge').innerText = prof?.display_name || sessionUser;
    document.getElementById('user-pfp-badge').src = prof?.pfp_url || getAvatarUrl(sessionUser);
}

async function sendMsg() {
    try {
        if (!await canSendMessage()) return;
        const val = document.getElementById('msg-input').value.trim();
        if (!val) return;
        document.getElementById('msg-input').value = '';

        await db.from('messages').insert([{
            content: val,
            author_username: sessionUser,
            room_id: currentRoom,
            type: 'text'
        }]);
    } catch (err) {
        showError('Failed to send message: ' + err.message);
    }
}

async function sendMediaMessage(dataUrl, mediaType) {
    try {
        if (!await canSendMessage()) return;
        await db.from('messages').insert([{
            content: dataUrl,
            author_username: sessionUser,
            room_id: currentRoom,
            type: mediaType
        }]);
    } catch (err) {
        showError('Failed to share media: ' + err.message);
    }
}

async function handleMediaPicker(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        showError('Media file is too large. Please use something smaller than 5MB.');
        return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
        const dataUrl = event.target.result;
        const mediaType = file.type.startsWith('video') ? 'video' : 'image';
        await sendMediaMessage(dataUrl, mediaType);
    };
    reader.readAsDataURL(file);
}

async function sendVoiceMessage(audioBlob) {
    try {
        if (!await canSendMessage()) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64Audio = e.target.result.split(',')[1];
            await db.from('messages').insert([{
                content: base64Audio,
                author_username: sessionUser,
                room_id: currentRoom,
                type: 'voice'
            }]);
        };
        reader.readAsDataURL(audioBlob);
    } catch (err) {
        showError('Failed to send voice message: ' + err.message);
    }
}

function toggleVoiceRecording() {
    if (!isRecording) {
        startVoiceRecording();
    } else {
        stopVoiceRecording();
    }
}

async function startVoiceRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        recordedChunks = [];

        mediaRecorder.ondataavailable = (e) => recordedChunks.push(e.data);
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
            await sendVoiceMessage(audioBlob);
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        isRecording = true;
        document.getElementById('voice-btn').classList.add('voice-recording');
        document.getElementById('voice-btn').innerText = '🔴';
    } catch (err) {
        showError('Microphone access denied: ' + err.message);
    }
}

function stopVoiceRecording() {
    if (mediaRecorder) {
        mediaRecorder.stop();
        isRecording = false;
        document.getElementById('voice-btn').classList.remove('voice-recording');
        document.getElementById('voice-btn').innerText = '🎤';
    }
}

async function switchRoom(id, name) {
    try {
        currentRoom = id;
        document.getElementById('current-room-name').innerText = name;
        document.querySelectorAll('.room-item').forEach(el => el.classList.remove('active'));
        if (document.getElementById(`room-${id}`)) document.getElementById(`room-${id}`).classList.add('active');
        loadMessages();
        setupRoomSub();
    } catch (err) {
        showError('Room switch error: ' + err.message);
    }
}

async function loadMessages() {
    try {
        const { data } = await db.from('messages').select('*').eq('room_id', currentRoom).order('created_at', { ascending: true }).limit(200);
        const list = document.getElementById('msg-list');
        list.innerHTML = '';
        if (data) {
            for (const m of data) {
                if (!userProfiles[m.author_username]) {
                    const { data: prof } = await db.from('accounts').select('*').eq('username', m.author_username).maybeSingle();
                    if (prof) userProfiles[m.author_username] = prof;
                }
                renderMessage(m);
            }
        }
        setTimeout(() => list.scrollTop = list.scrollHeight, 100);
    } catch (err) {
        showError('Failed to load messages: ' + err.message);
    }
}

function setupRoomSub() {
    if (activeSub) db.removeChannel(activeSub);
    activeSub = db.channel(currentRoom).on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${currentRoom}`
    }, async (p) => {
        if (!userProfiles[p.new.author_username]) {
            const { data: prof } = await db.from('accounts').select('*').eq('username', p.new.author_username).maybeSingle();
            if (prof) userProfiles[p.new.author_username] = prof;
        }
        renderMessage(p.new);
    }).on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages'
    }, (p) => {
        removeMessage(p.old.id);
    }).subscribe();
}

async function renderMessage(m) {
    try {
        const side = m.author_username === sessionUser ? 'me' : 'other';
        const prof = userProfiles[m.author_username];
        const avatarUrl = prof?.pfp_url || getAvatarUrl(m.author_username);
        const displayName = prof?.display_name || m.author_username;

        const wrapper = document.createElement('div');
        wrapper.className = `msg-wrapper ${side}`;
        wrapper.dataset.messageId = m.id;

        let contentHtml = '';
        if (m.type === 'voice') {
            contentHtml = `
                <div class="msg voice-msg">
                    <div class="voice-player">
                        <button onclick="playVoice(this)">▶️</button>
                        <audio style="display:none;" data-audio="${m.content}"></audio>
                        <progress value="0" max="100"></progress>
                    </div>
                </div>
            `;
        } else if (m.type === 'sticker') {
            const stickerUrl = m.content.startsWith('http') || m.content.startsWith('data:image') ? m.content : '';
            if (stickerUrl) {
                contentHtml = `<div class="msg" style="padding: 0; background: none; border: none;"><img src="${escapeHtml(stickerUrl)}" style="width: 150px; height: auto; border-radius: 10px; cursor: pointer;" onclick="copySticker(event)" data-sticker="${escapeHtml(stickerUrl)}" title="Click to copy"></div>`;
            } else {
                contentHtml = `<div class="msg sticker-msg" onclick="copySticker(event)" data-sticker="${escapeHtml(m.content)}">${escapeHtml(m.content)}</div>`;
            }
        } else if (m.type === 'image') {
            contentHtml = `<div class="msg" style="padding: 0; background: none; border: none;"><img class="message-media" src="${escapeHtml(m.content)}" alt="Shared photo"></div>`;
        } else if (m.type === 'video') {
            contentHtml = `<div class="msg" style="padding: 0; background: none; border: none;"><video class="message-media" controls src="${escapeHtml(m.content)}"></video></div>`;
        } else {
            contentHtml = `<div class="msg">${escapeHtml(m.content)}</div>`;
        }

        const deleteButton = (m.author_username === sessionUser || canModerate())
            ? `<button class="message-delete-btn" onclick="deleteMessage(${m.id})" title="Delete message">✕</button>`
            : '';

        wrapper.innerHTML = `
            <div style="display: flex; flex-direction: column; ${side === 'me' ? 'align-items: flex-end;' : ''}">
                <div class="author-name">${escapeHtml(displayName)}</div>
                <div style="display: flex; gap: 12px; align-items: flex-end; ${side === 'me' ? 'flex-direction: row-reverse;' : ''}">
                    <img class="avatar" src="${avatarUrl}" alt="${displayName}" title="${displayName}">
                    <div style="display:flex; align-items:flex-start; gap:6px;">
                        ${contentHtml}
                        ${deleteButton}
                    </div>
                </div>
            </div>
        `;
        document.getElementById('msg-list').appendChild(wrapper);
        document.getElementById('msg-list').scrollTop = document.getElementById('msg-list').scrollHeight;
    } catch (err) {
        console.error('Render error:', err);
    }
}

function removeMessage(id) {
    const el = document.querySelector(`[data-message-id="${id}"]`);
    if (el) el.remove();
}

function playVoice(btn) {
    try {
        const audio = btn.parentElement.querySelector('audio');
        const audioData = audio.dataset.audio;
        if (!audio.src) {
            audio.src = 'data:audio/webm;base64,' + audioData;
        }
        if (audio.paused) {
            audio.play();
            btn.innerText = '⏸️';
            audio.onended = () => btn.innerText = '▶️';
        } else {
            audio.pause();
            btn.innerText = '▶️';
        }
    } catch (err) {
        console.error('Playback error:', err);
    }
}

async function startPrivateChat() {
    try {
        const target = document.getElementById('user-search').value.trim();
        if (!target || target === sessionUser) {
            showError('Invalid user');
            return;
        }

        const { data: targetUser } = await db.from('accounts').select('*').eq('username', target).maybeSingle();
        if (!targetUser) {
            showError('User not found');
            return;
        }

        if (!userProfiles[target]) userProfiles[target] = targetUser;

        const roomId = [sessionUser, target].sort().join('_');
        if (!document.getElementById(`room-${roomId}`)) {
            await addContactToSidebar(target, roomId, targetUser);
        }
        document.getElementById('user-search').value = '';
        switchRoom(roomId, `@ ${targetUser.display_name || target}`);
    } catch (err) {
        showError('Error starting chat: ' + err.message);
    }
}

async function addContactToSidebar(username, roomId, userProf) {
    const prof = userProf || userProfiles[username];
    const avatarUrl = prof?.pfp_url || getAvatarUrl(username);
    const displayName = prof?.display_name || username;

    const div = document.createElement('div');
    div.id = `room-${roomId}`;
    div.className = 'room-item';
    div.onclick = () => switchRoom(roomId, `@ ${displayName}`);
    div.innerHTML = `
        <img class="sidebar-pfp" src="${avatarUrl}" alt="${displayName}">
        <strong>${displayName}</strong>
    `;
    document.getElementById('room-list').appendChild(div);
}

async function addFriend() {
    try {
        const target = document.getElementById('friend-username').value.trim();
        if (!target || target === sessionUser) {
            showError('Choose a valid friend');
            return;
        }
        const { data: targetUser } = await db.from('accounts').select('*').eq('username', target).maybeSingle();
        if (!targetUser) {
            showError('User not found');
            return;
        }
        const { data: existing } = await db.from('friends').select('*').eq('user_username', sessionUser).eq('friend_username', target).maybeSingle();
        if (existing) {
            showError('Already on your friends list');
            return;
        }
        await db.from('friends').insert([{ user_username: sessionUser, friend_username: target }]);
        document.getElementById('friend-username').value = '';
        loadFriends();
    } catch (err) {
        showError('Could not add friend: ' + err.message);
    }
}

async function removeFriend(username) {
    try {
        await db.from('friends').delete().eq('user_username', sessionUser).eq('friend_username', username);
        loadFriends();
    } catch (err) {
        showError('Could not remove friend: ' + err.message);
    }
}

async function openFriendChat(username) {
    const roomId = [sessionUser, username].sort().join('_');
    if (!document.getElementById(`room-${roomId}`)) {
        await addContactToSidebar(username, roomId, userProfiles[username]);
    }
    switchRoom(roomId, `@ ${userProfiles[username]?.display_name || username}`);
}

async function loadFriends() {
    try {
        const { data } = await db.from('friends').select('*').eq('user_username', sessionUser).order('created_at', { ascending: true });
        friends = data || [];
        const list = document.getElementById('friends-list');
        if (!list) return;
        list.innerHTML = '';
        if (!friends.length) {
            list.innerHTML = '<div class="empty-state">No friends yet</div>';
            return;
        }
        for (const friend of friends) {
            const name = friend.friend_username;
            if (!userProfiles[name]) {
                const { data: prof } = await db.from('accounts').select('*').eq('username', name).maybeSingle();
                if (prof) userProfiles[name] = prof;
            }
            const prof = userProfiles[name];
            const card = document.createElement('div');
            card.className = 'friend-card';
            card.innerHTML = `
                <strong>${escapeHtml(prof?.display_name || name)}</strong>
                <div class="friend-actions">
                    <button onclick="openFriendChat('${name}')">Chat</button>
                    <button class="danger" onclick="removeFriend('${name}')">Remove</button>
                </div>
            `;
            list.appendChild(card);
        }
    } catch (err) {
        console.error('Could not load friends:', err);
    }
}

function setupGlobalListener() {
    db.channel('global-updates').on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
    }, async (p) => {
        const msg = p.new;
        if (msg.room_id.includes(sessionUser) && msg.author_username !== sessionUser) {
            const otherUser = msg.author_username;
            if (!document.getElementById(`room-${msg.room_id}`)) {
                const { data: prof } = await db.from('accounts').select('*').eq('username', otherUser).maybeSingle();
                if (prof) userProfiles[otherUser] = prof;
                await addContactToSidebar(otherUser, msg.room_id, prof);
                triggerNotification(prof?.display_name || otherUser, msg.content);
            }
        }
    }).subscribe();
}

function triggerNotification(user, text) {
    try {
        if (window.Notification && Notification.permission === 'granted') {
            new Notification(`Nexus: ${user}`, { body: text.substring(0, 100) });
        }
    } catch (err) {
        console.error('Notification error:', err);
    }
}

function confirmWipeChat() {
    if (confirm('⚠️ DELETE ALL MESSAGES IN THIS ROOM? This cannot be undone.')) {
        wipeChat();
    }
}

async function wipeChat() {
    try {
        const { error } = await db.from('messages').delete().eq('room_id', currentRoom);
        if (error) throw error;
        document.getElementById('msg-list').innerHTML = '';
    } catch (err) {
        showError('Wipe failed: ' + err.message);
    }
}

async function deleteMessage(id) {
    if (!confirm('Delete this message?')) return;
    try {
        const { error } = await db.from('messages').delete().eq('id', id);
        if (error) throw error;
    } catch (err) {
        showError('Delete failed: ' + err.message);
    }
}

async function loadStickers() {
    try {
        const { data } = await db.from('stickers').select('*').order('created_at', { ascending: true });
        stickers = data || [];
        refreshStickerPanel();
    } catch (err) {
        console.error('Failed to load stickers:', err);
    }
}

function refreshStickerPanel() {
    const panel = document.getElementById('sticker-panel');
    if (!panel) return;
    panel.innerHTML = '';
    if (stickers.length === 0) {
        panel.innerHTML = '<div style="text-align: center; color: #888; padding: 10px;">No stickers yet</div>';
        return;
    }
    const grid = document.createElement('div');
    grid.className = 'sticker-grid';
    for (const s of stickers) {
        const item = document.createElement('div');
        item.className = 'sticker-item';
        const stickerContent = s.sticker || s.url || '';
        if (s.sticker && (s.sticker.startsWith('data:image') || s.sticker.startsWith('http'))) {
            const img = document.createElement('img');
            img.src = s.sticker;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '10px';
            item.appendChild(img);
        } else {
            item.textContent = stickerContent;
        }
        item.onclick = () => sendSticker(stickerContent);
        grid.appendChild(item);
    }
    panel.appendChild(grid);
}

function toggleStickerPanel() {
    const panel = document.getElementById('sticker-panel');
    stickerPanelOpen = !stickerPanelOpen;
    if (stickerPanelOpen) {
        panel.classList.add('active');
    } else {
        panel.classList.remove('active');
    }
}

async function sendSticker(sticker) {
    try {
        if (!await canSendMessage()) return;
        await db.from('messages').insert([{
            content: sticker,
            author_username: sessionUser,
            room_id: currentRoom,
            type: 'sticker'
        }]);
        document.getElementById('sticker-panel').classList.remove('active');
        stickerPanelOpen = false;
    } catch (err) {
        showError('Failed to send sticker: ' + err.message);
    }
}

function copySticker(event) {
    const sticker = event.target.dataset.sticker || event.target.textContent;
    navigator.clipboard.writeText(sticker);
}

function openStickerAdmin() {
    document.getElementById('sticker-admin-modal').classList.add('active');
    refreshStickerAdminList();
}

function closeStickerAdmin() {
    document.getElementById('sticker-admin-modal').classList.remove('active');
}

function refreshStickerAdminList() {
    const list = document.getElementById('sticker-admin-list');
    if (!list) return;
    list.innerHTML = '';
    for (const s of stickers) {
        const item = document.createElement('div');
        item.className = 'sticker-item admin-badge';
        item.style.position = 'relative';
        const stickerContent = s.sticker || s.url || '';
        if (s.sticker && (s.sticker.startsWith('data:image') || s.sticker.startsWith('http'))) {
            const img = document.createElement('img');
            img.src = s.sticker;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '10px';
            item.appendChild(img);
        } else {
            const span = document.createElement('span');
            span.style.fontSize = '24px';
            span.textContent = stickerContent;
            const wrapper = document.createElement('div');
            wrapper.style.position = 'absolute';
            wrapper.style.display = 'flex';
            wrapper.style.gap = '5px';
            wrapper.appendChild(span);
            item.appendChild(wrapper);
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '✕';
        deleteBtn.onclick = () => deleteSticker(s.id);
        deleteBtn.style.position = 'absolute';
        deleteBtn.style.top = '5px';
        deleteBtn.style.right = '5px';
        deleteBtn.style.background = 'var(--error)';
        deleteBtn.style.border = 'none';
        deleteBtn.style.color = 'white';
        deleteBtn.style.borderRadius = '50%';
        deleteBtn.style.width = '24px';
        deleteBtn.style.height = '24px';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.padding = '0';
        deleteBtn.style.fontSize = '12px';
        item.appendChild(deleteBtn);
        list.appendChild(item);
    }
}

async function handleStickerFileSelection(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
        const dataUrl = event.target.result;
        localStorage.setItem('pendingSticker', dataUrl);
        document.getElementById('sticker-input').value = dataUrl;
    };
    reader.readAsDataURL(file);
}

async function addSticker() {
    try {
        const input = document.getElementById('sticker-input');
        const stickerText = input.value.trim();
        const stickerFileValue = localStorage.getItem('pendingSticker');
        const stickerValue = stickerFileValue || stickerText;

        if (!stickerValue) {
            showError('Choose an emoji or upload an image sticker');
            return;
        }

        const { error } = await db.from('stickers').insert([{ sticker: stickerValue, added_by: sessionUser }]);
        if (error) throw error;

        input.value = '';
        localStorage.removeItem('pendingSticker');
        await loadStickers();
        refreshStickerAdminList();
    } catch (err) {
        showError('Failed to add sticker: ' + err.message);
    }
}

async function deleteSticker(stickerIdParam) {
    if (!confirm('Delete this sticker?')) return;
    try {
        const { error } = await db.from('stickers').delete().eq('id', stickerIdParam);
        if (error) throw error;
        await loadStickers();
        refreshStickerAdminList();
    } catch (err) {
        showError('Failed to delete sticker: ' + err.message);
    }
}

function openModerationModal() {
    document.getElementById('moderation-modal').classList.add('active');
}

function closeModerationModal() {
    document.getElementById('moderation-modal').classList.remove('active');
}

async function applyModeration(action) {
    try {
        if (!canModerate()) {
            showError('Only admins and owners can moderate users.');
            return;
        }
        const target = document.getElementById('mod-target').value.trim();
        const reason = document.getElementById('mod-reason').value.trim();
        const hours = Number(document.getElementById('mod-duration').value || 0);
        const expiry = hours > 0 ? new Date(Date.now() + hours * 60 * 60 * 1000).toISOString() : null;
        if (!target) {
            showError('Choose a username');
            return;
        }
        if (action === 'ban') {
            const { data: existing } = await db.from('banned_users').select('*').eq('banned_username', target).maybeSingle();
            if (existing) {
                await db.from('banned_users').update({ banned_by_username: sessionUser, reason, expires_at: expiry }).eq('banned_username', target);
            } else {
                await db.from('banned_users').insert([{ banned_username: target, banned_by_username: sessionUser, reason, expires_at: expiry }]);
            }
        } else {
            const { data: existing } = await db.from('muted_users').select('*').eq('muted_username', target).maybeSingle();
            if (existing) {
                await db.from('muted_users').update({ muted_by_username: sessionUser, reason, muted_until: expiry }).eq('muted_username', target);
            } else {
                await db.from('muted_users').insert([{ muted_username: target, muted_by_username: sessionUser, reason, muted_until: expiry }]);
            }
        }
        closeModerationModal();
    } catch (err) {
        showError('Moderation action failed: ' + err.message);
    }
}

async function clearModeration(action) {
    try {
        if (!canModerate()) {
            showError('Only admins and owners can moderate users.');
            return;
        }
        const target = document.getElementById('mod-target').value.trim();
        if (!target) {
            showError('Choose a username');
            return;
        }
        if (action === 'ban') {
            await db.from('banned_users').delete().eq('banned_username', target);
        } else {
            await db.from('muted_users').delete().eq('muted_username', target);
        }
        closeModerationModal();
    } catch (err) {
        showError('Could not clear moderation: ' + err.message);
    }
}

window.addEventListener('DOMContentLoaded', initApp);
window.handleAuth = handleAuth;
window.logout = logout;
window.changeTheme = changeTheme;
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.saveProfile = saveProfile;
window.sendMsg = sendMsg;
window.toggleVoiceRecording = toggleVoiceRecording;
window.startPrivateChat = startPrivateChat;
window.switchRoom = switchRoom;
window.toggleStickerPanel = toggleStickerPanel;
window.openStickerAdmin = openStickerAdmin;
window.closeStickerAdmin = closeStickerAdmin;
window.addSticker = addSticker;
window.confirmWipeChat = confirmWipeChat;
window.copySticker = copySticker;
window.playVoice = playVoice;
window.addFriend = addFriend;
window.removeFriend = removeFriend;
window.openFriendChat = openFriendChat;
window.deleteMessage = deleteMessage;
window.openModerationModal = openModerationModal;
window.closeModerationModal = closeModerationModal;
window.applyModeration = applyModeration;
window.clearModeration = clearModeration;
