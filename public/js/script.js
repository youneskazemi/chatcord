class ChatApp {
  constructor() {
    this.socket = null;
    this.currentUser = null;
    this.currentChannel = "general";
    this.inVoiceChat = false;
    this.isMuted = false;
    this.isDeafened = false;
    this.voiceChannel = null;
    this.peerConnections = new Map();
    this.localStream = null;
    this.typingUsers = new Set();
    this.typingTimeout = null;
    this.rtcConfig = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
      ],
    };
    this.dmConversations = new Map(); // Store DM conversations
    this.currentDmConversation = null; // Current DM conversation
    this.inDmChat = false; // Whether we're in a DM chat
    this.allUsers = []; // Store all users for DM search
    this.isDarkTheme = true; // Track current theme
    this.emojis = {
      recent: ["👍", "❤️", "😊", "🙌", "👏", "🔥", "🎉", "💯"],
      smileys: [
        "😀",
        "😃",
        "😄",
        "😁",
        "😆",
        "😅",
        "😂",
        "🤣",
        "😊",
        "😇",
        "🙂",
        "🙃",
        "😉",
        "😌",
        "😍",
        "🥰",
        "😘",
      ],
      people: [
        "👋",
        "👌",
        "👍",
        "👎",
        "👏",
        "🙌",
        "👐",
        "🤲",
        "🤝",
        "🙏",
        "✌️",
        "🤞",
        "🤟",
        "🤘",
        "🤙",
      ],
      animals: [
        "🐶",
        "🐱",
        "🐭",
        "🐹",
        "🐰",
        "🦊",
        "🐻",
        "🐼",
        "🐨",
        "🐯",
        "🦁",
        "🐮",
        "🐷",
        "🐸",
        "🐵",
      ],
      food: [
        "🍏",
        "🍎",
        "🍐",
        "🍊",
        "🍋",
        "🍌",
        "🍉",
        "🍇",
        "🍓",
        "🍈",
        "🍒",
        "🍑",
        "🥭",
        "🍍",
        "🥥",
        "🥝",
        "🍅",
      ],
      travel: [
        "✈️",
        "🚗",
        "🚕",
        "🚙",
        "🚌",
        "🚎",
        "🏎️",
        "🚓",
        "🚑",
        "🚒",
        "🚐",
        "🛻",
        "🚚",
        "🚛",
        "🚜",
      ],
      activities: [
        "⚽",
        "🏀",
        "🏈",
        "⚾",
        "🥎",
        "🎾",
        "🏐",
        "🏉",
        "🥏",
        "🎱",
        "🪀",
        "🏓",
        "🏸",
      ],
      objects: [
        "⌚",
        "📱",
        "💻",
        "⌨️",
        "🖥️",
        "🖱️",
        "🖨️",
        "🖼️",
        "📞",
        "☎️",
        "📟",
        "📠",
        "📺",
        "📻",
        "🎙️",
      ],
      symbols: [
        "❤️",
        "🧡",
        "💛",
        "💚",
        "💙",
        "💜",
        "🖤",
        "🤍",
        "🤎",
        "💔",
        "❣️",
        "💕",
        "💞",
        "💓",
        "💗",
      ],
      flags: ["🏳️", "🏴", "🏁", "🚩", "🏳️‍🌈", "🏳️‍⚧️", "🇺🇳"],
    };
    this.currentEmojiCategory = "recent";

    this.init();
  }

  async init() {
    this.connectToServer();
    this.setupEventListeners();
    this.loadThemePreference();
    this.showUsernameModal();
  }

  connectToServer() {
    this.socket = io();

    this.socket.on("connect", () => {
      this.updateConnectionStatus("Connected", true);
    });

    this.socket.on("disconnect", () => {
      this.updateConnectionStatus("Disconnected", false);
    });

    this.socket.on("joinSuccess", (data) => {
      this.currentUser = data.user;
      this.currentChannel = data.channel.name;

      // Update user info in UI
      document.getElementById("currentUsername").textContent =
        data.user.username;
      document.getElementById("currentUserAvatar").textContent =
        data.user.username.charAt(0).toUpperCase();
      document.getElementById("currentUserAvatar").style.background =
        data.user.color;

      // Update UI
      document.getElementById("currentChannelName").textContent =
        data.channel.name;
      document.getElementById(
        "messageInput"
      ).placeholder = `Message #${data.channel.name}`;

      // Set active channel
      document
        .querySelectorAll(".channel")
        .forEach((ch) => ch.classList.remove("active"));
      document
        .querySelector(`[data-channel="${data.channel.name}"]`)
        .classList.add("active");

      this.renderMessages(data.messages);
      this.updateUserList(data.users);
      this.hideModal();

      // Get DM conversations
      this.loadDmConversations();

      // Get all users for DM search
      this.loadAllUsers();
    });

    this.socket.on("joinError", (data) => {
      // Determine which form is active and show appropriate error
      const loginForm = document.getElementById("loginForm");
      const registerForm = document.getElementById("registerForm");

      if (loginForm.style.display !== "none") {
        this.showLoginError(data.message);
      } else {
        this.showRegisterError(data.message);
      }
    });

    this.socket.on("userJoined", (data) => {
      if (data.username && data.userId) {
        this.showNotification(`${data.username} joined the channel`);
      }
    });

    this.socket.on("userLeft", (data) => {
      this.showNotification(`${data.username} left the channel`);
    });

    this.socket.on("channelSwitched", (data) => {
      this.currentChannel = data.channel.name;
      document.getElementById("currentChannelName").textContent =
        data.channel.name;
      document.getElementById(
        "messageInput"
      ).placeholder = `Message #${data.channel.name}`;

      this.renderMessages(data.messages);
      this.updateUserList(data.users);
    });

    this.socket.on("newMessage", (message) => {
      this.addMessage(message);
    });

    this.socket.on("updateUserList", (users) => {
      this.updateUserList(users);
    });

    this.socket.on("userTyping", (data) => {
      this.showTypingIndicator(data.username);
    });

    this.socket.on("userStoppedTyping", (data) => {
      this.hideTypingIndicator(data.userId);
    });

    // Voice chat events
    this.socket.on("voiceChannelJoined", (data) => {
      this.onVoiceChannelJoined(data);
    });

    this.socket.on("userJoinedVoice", (data) => {
      this.onUserJoinedVoice(data);
    });

    this.socket.on("userLeftVoice", (data) => {
      this.onUserLeftVoice(data);
    });

    // WebRTC signaling
    this.socket.on("webrtc-offer", (data) => {
      this.handleWebRTCOffer(data);
    });

    this.socket.on("webrtc-answer", (data) => {
      this.handleWebRTCAnswer(data);
    });

    this.socket.on("webrtc-ice-candidate", (data) => {
      this.handleWebRTCIceCandidate(data);
    });

    // DM events
    this.socket.on("dmConversationsList", (conversations) => {
      this.renderDmConversations(conversations);
    });

    // Keep the old event handler for backward compatibility
    this.socket.on("dmConversations", (conversations) => {
      this.renderDmConversations(conversations);
    });

    this.socket.on("dmConversationCreated", (data) => {
      this.switchToDmConversation(data.conversation, data.messages);
    });

    this.socket.on("dmSwitched", (data) => {
      this.switchToDmConversation(data.conversation, data.messages);
    });

    this.socket.on("newDMMessage", (data) => {
      if (
        this.inDmChat &&
        this.currentDmConversation &&
        this.currentDmConversation.id === data.conversationId
      ) {
        // We're currently viewing this conversation
        this.addMessage(data.message);

        // If we received a message, mark it as read
        if (data.message.user.id !== this.currentUser.id) {
          this.socket.emit("markDMRead", {
            conversationId: data.conversationId,
          });
        }
      } else {
        // Show notification for new DM
        this.showDmNotification(data.conversationId);
      }
    });

    this.socket.on("newDMNotification", (data) => {
      // Add conversation to list if not exists
      if (!this.dmConversations.has(data.conversation.id)) {
        this.dmConversations.set(data.conversation.id, data.conversation);
        this.renderDmConversations([...this.dmConversations.values()]);
      }

      // Show notification
      this.showDmNotification(data.conversation.id);
      this.showNotification(
        `New message from ${data.conversation.targetUser.username}`
      );
    });

    this.socket.on("allUsers", (data) => {
      console.log("Received users:", data);
      if (data && data.users) {
        this.allUsers = data.users;

        // If the DM modal is open, refresh the search results
        if (document.getElementById("newDmModal").style.display === "flex") {
          this.searchUsers(document.getElementById("dmUserSearch").value);
        }
      } else {
        console.error("Invalid data received for allUsers event:", data);
      }
    });

    // Message reaction events
    this.socket.on("messageReactionUpdated", (data) => {
      this.updateMessageReactions(data.messageId, data.reactions);
    });

    this.socket.on("dmMessageReactionUpdated", (data) => {
      this.updateMessageReactions(data.messageId, data.reactions);
    });

    // Message edit events
    this.socket.on("messageEdited", (message) => {
      this.updateEditedMessage(message);
    });

    this.socket.on("dmMessageEdited", (message) => {
      this.updateEditedMessage(message);
    });

    // Read receipt event
    this.socket.on("dmMessagesRead", (data) => {
      this.updateReadReceipts(data.conversationId, data.readerId, data.readAt);
    });
  }

  setupEventListeners() {
    // Auth tab switching
    document
      .getElementById("loginTab")
      .addEventListener("click", () => this.showLoginForm());
    document
      .getElementById("registerTab")
      .addEventListener("click", () => this.showRegisterForm());
    document
      .getElementById("switchToRegister")
      .addEventListener("click", (e) => {
        e.preventDefault();
        this.showRegisterForm();
      });
    document.getElementById("switchToLogin").addEventListener("click", (e) => {
      e.preventDefault();
      this.showLoginForm();
    });

    // Login form
    const loginUsername = document.getElementById("loginUsername");
    const loginPassword = document.getElementById("loginPassword");
    const loginBtn = document.getElementById("loginBtn");

    loginUsername.addEventListener("input", () => this.validateLoginForm());
    loginPassword.addEventListener("input", () => this.validateLoginForm());

    loginUsername.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        if (loginUsername.value.trim()) {
          loginPassword.focus();
        }
      }
    });

    loginPassword.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !loginBtn.disabled) {
        this.handleLogin();
      }
    });

    loginBtn.addEventListener("click", () => this.handleLogin());

    // Register form
    const registerUsername = document.getElementById("registerUsername");
    const registerPassword = document.getElementById("registerPassword");
    const confirmPassword = document.getElementById("confirmPassword");
    const registerBtn = document.getElementById("registerBtn");

    registerUsername.addEventListener("input", () =>
      this.validateRegisterForm()
    );
    registerPassword.addEventListener("input", () =>
      this.validateRegisterForm()
    );
    confirmPassword.addEventListener("input", () =>
      this.validateRegisterForm()
    );

    registerUsername.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && registerUsername.value.trim()) {
        registerPassword.focus();
      }
    });

    registerPassword.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        if (registerPassword.value.trim()) {
          confirmPassword.focus();
        } else if (!registerBtn.disabled) {
          this.handleRegister();
        }
      }
    });

    confirmPassword.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !registerBtn.disabled) {
        this.handleRegister();
      }
    });

    registerBtn.addEventListener("click", () => this.handleRegister());

    // Channel switching
    document.querySelectorAll(".channel").forEach((channel) => {
      channel.addEventListener("click", (e) => {
        if (!e.target.classList.contains("voice-btn")) {
          this.switchChannel(e.currentTarget.dataset.channel);
        }
      });
    });

    // Message input
    const messageInput = document.getElementById("messageInput");
    messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    let typingTimer;
    messageInput.addEventListener("input", () => {
      this.socket.emit("typing", { channelName: this.currentChannel });

      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        this.socket.emit("stopTyping", { channelName: this.currentChannel });
      }, 1000);
    });

    // Auto-resize textarea
    messageInput.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 120) + "px";
    });

    // Emoji button
    const emojiButton = document.getElementById("emojiButton");
    if (emojiButton) {
      emojiButton.addEventListener("click", () => this.showEmojiPicker());
    }

    // DM event listeners
    document.getElementById("newDmBtn").addEventListener("click", () => {
      this.showNewDmModal();
    });

    document.getElementById("cancelDmBtn").addEventListener("click", () => {
      this.hideNewDmModal();
    });

    // DM search
    const dmUserSearch = document.getElementById("dmUserSearch");
    dmUserSearch.addEventListener("input", () => {
      this.searchUsers(dmUserSearch.value);
    });

    // Theme toggle
    document.getElementById("themeToggle").addEventListener("click", () => {
      this.toggleTheme();
    });

    // Mobile navigation toggle
    document.getElementById("mobileToggle").addEventListener("click", () => {
      document.getElementById("sidebar").classList.toggle("expanded");
    });

    // Emoji search
    document.getElementById("emojiSearch").addEventListener("input", (e) => {
      this.searchEmojis(e.target.value);
    });

    // Emoji category selection
    document.querySelectorAll(".emoji-category").forEach((category) => {
      category.addEventListener("click", () => {
        document
          .querySelectorAll(".emoji-category")
          .forEach((c) => c.classList.remove("active"));
        category.classList.add("active");
        this.currentEmojiCategory = category.dataset.category;
        this.populateEmojiCategory(this.currentEmojiCategory);
      });
    });

    // Message reactions
    document.getElementById("chatMessages").addEventListener("click", (e) => {
      if (
        e.target.classList.contains("message-action-btn") &&
        e.target.dataset.action === "react"
      ) {
        this.showReactionPicker(e.target.closest(".message").dataset.id);
      }

      if (
        e.target.classList.contains("message-action-btn") &&
        e.target.dataset.action === "edit"
      ) {
        this.editMessage(e.target.closest(".message").dataset.id);
      }

      if (e.target.classList.contains("reaction")) {
        this.toggleReaction(e.target.dataset.messageId, e.target.dataset.emoji);
      }
    });

    // Voice buttons context menu
    document.querySelectorAll(".voice-btn").forEach((btn) => {
      btn.addEventListener("contextmenu", (e) => {
        e.preventDefault();

        // Create context menu
        const contextMenu = document.createElement("div");
        contextMenu.className = "voice-context-menu";

        // Add troubleshoot option
        const troubleshootOption = document.createElement("div");
        troubleshootOption.className = "context-menu-item";
        troubleshootOption.textContent = "Troubleshoot Microphone";
        troubleshootOption.addEventListener("click", () => {
          this.troubleshootMicrophonePermissions();
          contextMenu.remove();
        });

        contextMenu.appendChild(troubleshootOption);

        // Position menu
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.style.left = `${e.clientX}px`;

        // Add to body
        document.body.appendChild(contextMenu);

        // Remove on click outside
        setTimeout(() => {
          const clickHandler = () => {
            contextMenu.remove();
            document.removeEventListener("click", clickHandler);
          };
          document.addEventListener("click", clickHandler);
        }, 0);
      });
    });
  }

  updateConnectionStatus(status, connected) {
    const statusEl = document.getElementById("connectionStatus");
    statusEl.textContent = status;
    statusEl.className = `connection-status ${connected ? "" : "disconnected"}`;

    if (connected) {
      setTimeout(() => {
        statusEl.style.display = "none";
      }, 2000);
    } else {
      statusEl.style.display = "block";
    }
  }

  showUsernameModal() {
    document.getElementById("usernameModal").style.display = "flex";
    document.getElementById("usernameInput").focus();
  }

  showLoginForm() {
    document.getElementById("loginTab").classList.add("active");
    document.getElementById("registerTab").classList.remove("active");
    document.getElementById("loginForm").style.display = "block";
    document.getElementById("registerForm").style.display = "none";
    document.getElementById("loginUsername").focus();
    this.hideAllErrors();
  }

  showRegisterForm() {
    document.getElementById("registerTab").classList.add("active");
    document.getElementById("loginTab").classList.remove("active");
    document.getElementById("registerForm").style.display = "block";
    document.getElementById("loginForm").style.display = "none";
    document.getElementById("registerUsername").focus();
    this.hideAllErrors();
  }

  validateLoginForm() {
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value.trim();
    const loginBtn = document.getElementById("loginBtn");

    loginBtn.disabled = !username || !password;
  }

  validateRegisterForm() {
    const username = document.getElementById("registerUsername").value.trim();
    const password = document.getElementById("registerPassword").value.trim();
    const confirmPassword = document
      .getElementById("confirmPassword")
      .value.trim();
    const registerBtn = document.getElementById("registerBtn");

    // Username is required
    if (!username) {
      registerBtn.disabled = true;
      return;
    }

    // If password is set, confirmation must match
    if (password && password !== confirmPassword) {
      this.showRegisterError("Passwords do not match");
      registerBtn.disabled = true;
      return;
    }

    this.hideRegisterError();
    registerBtn.disabled = false;
  }

  handleLogin() {
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    if (username && password) {
      this.hideLoginError();
      this.setButtonLoading("loginBtn", "Logging in...");
      this.socket.emit("join", { username, password, isLogin: true });
    }
  }

  handleRegister() {
    const username = document.getElementById("registerUsername").value.trim();
    const password = document.getElementById("registerPassword").value.trim();
    const confirmPassword = document
      .getElementById("confirmPassword")
      .value.trim();

    if (!username) return;

    if (password && password !== confirmPassword) {
      this.showRegisterError("Passwords do not match");
      return;
    }

    this.hideRegisterError();
    this.setButtonLoading("registerBtn", "Creating account...");
    this.socket.emit("join", {
      username,
      password: password || null,
      isLogin: false,
    });
  }

  setButtonLoading(buttonId, text) {
    const button = document.getElementById(buttonId);
    button.disabled = true;
    button.textContent = text;
  }

  resetButtons() {
    document.getElementById("loginBtn").disabled = false;
    document.getElementById("loginBtn").textContent = "Login";
    document.getElementById("registerBtn").disabled = false;
    document.getElementById("registerBtn").textContent = "Create Account";
  }

  showLoginError(message) {
    const errorEl = document.getElementById("loginError");
    errorEl.textContent = message;
    errorEl.style.display = "block";
    this.resetButtons();
  }

  hideLoginError() {
    document.getElementById("loginError").style.display = "none";
  }

  showRegisterError(message) {
    const errorEl = document.getElementById("registerError");
    errorEl.textContent = message;
    errorEl.style.display = "block";
  }

  hideRegisterError() {
    document.getElementById("registerError").style.display = "none";
  }

  hideAllErrors() {
    this.hideLoginError();
    this.hideRegisterError();
  }

  hideModal() {
    document.getElementById("usernameModal").style.display = "none";
    document.getElementById("messageInput").focus();
  }

  switchChannel(channelName) {
    if (channelName === this.currentChannel && !this.inDmChat) return;

    // Update UI
    document
      .querySelectorAll(".channel, .dm-channel")
      .forEach((ch) => ch.classList.remove("active"));
    document
      .querySelector(`[data-channel="${channelName}"]`)
      .classList.add("active");

    // Update state
    this.currentChannel = channelName;
    this.inDmChat = false;
    this.currentDmConversation = null;

    // Update header
    document.getElementById("currentChannelIcon").textContent = "#";
    document.getElementById("currentChannelName").textContent = channelName;
    document.getElementById(
      "messageInput"
    ).placeholder = `Message #${channelName}`;

    // Notify server
    this.socket.emit("switchChannel", { channelName });
  }

  sendMessage() {
    const messageInput = document.getElementById("messageInput");
    const text = messageInput.value.trim();

    if (text) {
      this.socket.emit("sendMessage", {
        text,
        channelName: this.inDmChat ? null : this.currentChannel,
        isDM: this.inDmChat,
        targetUserId: this.inDmChat
          ? this.currentDmConversation.targetUser.id
          : null,
      });

      messageInput.value = "";
      messageInput.style.height = "auto";

      this.socket.emit("stopTyping", { channelName: this.currentChannel });
    }
  }

  addMessage(message) {
    const chatMessages = document.getElementById("chatMessages");
    const messageElement = document.createElement("div");
    messageElement.classList.add("message");
    messageElement.dataset.id = message.id;
    messageElement.dataset.userId = message.user.id;
    messageElement.style.animation = "fadeIn 0.3s ease";

    const avatar = document.createElement("div");
    avatar.classList.add("message-avatar");
    avatar.style.background =
      message.user.color || this.getUserColor(message.user.username);
    avatar.textContent = message.user.username.charAt(0).toUpperCase();

    const content = document.createElement("div");
    content.classList.add("message-content");

    const header = document.createElement("div");
    header.classList.add("message-header");

    const author = document.createElement("span");
    author.classList.add("message-author");
    author.textContent = message.user.username;
    author.style.color =
      message.user.color || this.getUserColor(message.user.username);

    const timestamp = document.createElement("span");
    timestamp.classList.add("message-timestamp");
    timestamp.textContent = this.formatTime(new Date(message.created_at));

    const messageText = document.createElement("div");
    messageText.classList.add("message-text");
    messageText.textContent = message.content;

    // Add edited indicator if message was edited
    if (message.edited_at) {
      const editedIndicator = document.createElement("span");
      editedIndicator.classList.add("edited-indicator");
      editedIndicator.textContent = " (edited)";
      editedIndicator.style.fontSize = "0.8em";
      editedIndicator.style.opacity = "0.7";
      messageText.appendChild(editedIndicator);
    }

    // Add read receipt if message is in DM and has been read
    if (
      this.inDmChat &&
      message.user.id === this.currentUser.id &&
      message.is_read
    ) {
      const readReceipt = document.createElement("div");
      readReceipt.className = "read-receipt";
      readReceipt.title = `Read at ${
        message.read_at
          ? new Date(message.read_at).toLocaleTimeString()
          : "Unknown time"
      }`;
      readReceipt.innerHTML = "✓";
      content.appendChild(readReceipt);
    }

    header.appendChild(author);
    header.appendChild(timestamp);
    content.appendChild(header);
    content.appendChild(messageText);

    messageElement.appendChild(avatar);
    messageElement.appendChild(content);

    // Add message actions
    const messageActions = document.createElement("div");
    messageActions.classList.add("message-actions");

    const reactionButton = document.createElement("button");
    reactionButton.classList.add("message-action-btn");
    reactionButton.dataset.action = "react";
    reactionButton.innerHTML = "😊";
    reactionButton.title = "Add Reaction";
    messageActions.appendChild(reactionButton);

    // Only show edit button for user's own messages
    if (message.user.id === this.currentUser.id) {
      const editButton = document.createElement("button");
      editButton.classList.add("message-action-btn");
      editButton.dataset.action = "edit";
      editButton.innerHTML = "✏️";
      editButton.title = "Edit Message";
      messageActions.appendChild(editButton);
    }

    messageElement.appendChild(messageActions);

    // Add reactions if any
    if (message.reactions && Object.keys(message.reactions).length > 0) {
      const reactionsContainer = document.createElement("div");
      reactionsContainer.classList.add("message-reactions");

      Object.entries(message.reactions).forEach(([emoji, users]) => {
        const reactionElement = document.createElement("div");
        reactionElement.classList.add("reaction");
        reactionElement.dataset.messageId = message.id;
        reactionElement.dataset.emoji = emoji;

        // Check if current user reacted with this emoji
        if (users.includes(this.currentUser.id)) {
          reactionElement.classList.add("active");
        }

        reactionElement.innerHTML = `${emoji} <span class="reaction-count">${users.length}</span>`;
        reactionsContainer.appendChild(reactionElement);
      });

      messageElement.appendChild(reactionsContainer);
    }

    chatMessages.appendChild(messageElement);
    this.scrollToBottom();

    // Remove typing indicator for this user if exists
    this.hideTypingIndicator(message.user.id);
  }

  renderMessages(messages) {
    const chatMessages = document.getElementById("chatMessages");
    chatMessages.innerHTML = "";

    messages.forEach((message) => {
      this.addMessage(message);
    });
  }

  updateUserList(users) {
    const userListContainer = document.getElementById("userListContainer");
    userListContainer.innerHTML = "";

    users.forEach((user) => {
      const userEl = document.createElement("div");
      userEl.className = "user-item";

      const avatar = document.createElement("div");
      avatar.className = "user-item-avatar";
      avatar.style.background = user.color;
      avatar.textContent = user.username.charAt(0).toUpperCase();

      const name = document.createElement("div");
      name.className = "user-item-name";
      name.textContent = user.username;

      userEl.appendChild(avatar);
      userEl.appendChild(name);

      if (user.inVoiceChat) {
        const voiceIndicator = document.createElement("div");
        voiceIndicator.className = "user-voice-indicator";
        voiceIndicator.textContent = "🔊";
        userEl.appendChild(voiceIndicator);
      }

      userListContainer.appendChild(userEl);
    });
  }

  showTypingIndicator(username) {
    this.typingUsers.add(username);
    this.updateTypingIndicator();
  }

  hideTypingIndicator(userId) {
    // Remove user from typing (simplified)
    this.updateTypingIndicator();
  }

  updateTypingIndicator() {
    const indicator = document.getElementById("typingIndicator");
    const text = document.getElementById("typingText");

    if (this.typingUsers.size > 0) {
      const users = Array.from(this.typingUsers);
      if (users.length === 1) {
        text.textContent = `${users[0]} is typing...`;
      } else {
        text.textContent = `${users.length} people are typing...`;
      }
      indicator.style.display = "block";

      clearTimeout(this.typingTimeout);
      this.typingTimeout = setTimeout(() => {
        this.typingUsers.clear();
        indicator.style.display = "none";
      }, 3000);
    } else {
      indicator.style.display = "none";
    }
  }

  formatTime(date) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  scrollToBottom() {
    const chatMessages = document.getElementById("chatMessages");
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  showNotification(message, type = "default", duration = 3000) {
    const notificationContainer = document.createElement("div");
    notificationContainer.className = `notification ${type}`;
    notificationContainer.textContent = message;
    document.body.appendChild(notificationContainer);

    setTimeout(() => {
      notificationContainer.style.opacity = "0";
      setTimeout(() => {
        notificationContainer.remove();
      }, 300);
    }, duration);
  }

  // Check microphone permissions
  async checkMicrophonePermission() {
    // First check if we're on localhost (always considered secure)
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    // First check if the browser supports mediaDevices API
    if (!navigator.mediaDevices) {
      console.error(
        "navigator.mediaDevices is not available, trying legacy methods"
      );

      // Try legacy getUserMedia methods
      const getUserMedia =
        navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia;

      if (!getUserMedia) {
        // Check if using HTTP instead of HTTPS (except for localhost)
        if (window.location.protocol === "http:" && !isLocalhost) {
          return {
            granted: false,
            reason: "insecure",
            message:
              "Media access requires HTTPS. Please use a secure connection (HTTPS).",
          };
        }

        return {
          granted: false,
          reason: "unsupported",
          message:
            "Your browser doesn't support accessing the microphone. Please try using Chrome, Firefox, or Edge.",
        };
      }

      // Use legacy method with Promise wrapper
      return new Promise((resolve) => {
        getUserMedia.call(
          navigator,
          { audio: true },
          function (stream) {
            // Success - stop all tracks
            stream.getTracks().forEach((track) => track.stop());
            resolve({ granted: true });
          },
          function (error) {
            console.error("Legacy getUserMedia error:", error);
            if (
              error.name === "PermissionDeniedError" ||
              error.name === "NotAllowedError"
            ) {
              resolve({
                granted: false,
                reason: "denied",
                message:
                  "Microphone access denied. Please allow microphone access in your browser settings.",
              });
            } else {
              resolve({
                granted: false,
                reason: "other",
                message: `Microphone error: ${
                  error.name || error.message || "unknown error"
                }. Please check your settings.`,
              });
            }
          }
        );
      });
    }

    try {
      // Check if we can access the microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Stop all tracks immediately as we just needed to check permission
      stream.getTracks().forEach((track) => track.stop());

      return { granted: true };
    } catch (error) {
      console.error("Microphone permission error:", error);

      if (error.name === "NotAllowedError") {
        return {
          granted: false,
          reason: "denied",
          message:
            "Microphone access denied. Please allow microphone access in your browser settings.",
        };
      } else if (error.name === "NotFoundError") {
        return {
          granted: false,
          reason: "notFound",
          message:
            "No microphone found. Please connect a microphone and try again.",
        };
      } else {
        return {
          granted: false,
          reason: "other",
          message: `Microphone error: ${error.message}. Please check your settings.`,
        };
      }
    }
  }

  // Troubleshoot microphone permissions
  async troubleshootMicrophonePermissions() {
    const permissionStatus = await this.checkMicrophonePermission();
    const browserInfo = this.detectBrowser();

    let message = "";
    let instructionsByBrowser = "";

    // Get browser-specific instructions
    if (browserInfo.browser === "Chrome") {
      instructionsByBrowser =
        "In Chrome, click the lock icon in the address bar and ensure microphone access is allowed.";
    } else if (browserInfo.browser === "Firefox") {
      instructionsByBrowser =
        "In Firefox, click the lock icon in the address bar and select 'Allow' for microphone access.";
    } else if (browserInfo.browser === "Safari") {
      instructionsByBrowser =
        "In Safari, go to Preferences > Websites > Microphone and allow access for this site.";
    } else if (browserInfo.browser === "Edge") {
      instructionsByBrowser =
        "In Edge, click the lock icon in the address bar and ensure microphone access is allowed.";
    } else if (browserInfo.browser === "Internet Explorer") {
      instructionsByBrowser =
        "Internet Explorer is not supported for voice chat. Please use a modern browser like Chrome, Firefox, or Edge.";
    }

    if (!permissionStatus.granted) {
      if (permissionStatus.reason === "denied") {
        message = `Microphone access was denied. ${instructionsByBrowser} After changing settings, refresh the page.`;
      } else if (permissionStatus.reason === "notFound") {
        message =
          "No microphone was detected. Please connect a microphone to your device and try again.";
      } else if (permissionStatus.reason === "unsupported") {
        message = `Your browser (${browserInfo.browser} ${browserInfo.version}) doesn't support accessing the microphone. Please try using the latest version of Chrome, Firefox, or Edge.`;
      } else if (permissionStatus.reason === "insecure") {
        message =
          "Media access requires HTTPS. Please use a secure connection or try accessing the site via localhost.";
      } else {
        message = `${permissionStatus.message} ${instructionsByBrowser}`;
      }

      // Show browser compatibility information
      console.log(
        `Browser detected: ${browserInfo.browser} ${browserInfo.version}`
      );

      // Create a more detailed help modal
      const helpModal = document.createElement("div");
      helpModal.className = "help-modal";
      helpModal.innerHTML = `
        <div class="help-modal-content">
          <h3>Microphone Troubleshooting</h3>
          <p>${message}</p>
          
          <div class="browser-info">
            <h4>Your Browser</h4>
            <p>${browserInfo.browser} ${browserInfo.version}</p>
          </div>
          
          <div class="compatibility-info">
            <h4>Compatible Browsers</h4>
            <ul>
              <li>Chrome 47+</li>
              <li>Firefox 44+</li>
              <li>Edge 79+</li>
              <li>Safari 11+</li>
            </ul>
          </div>
          
          <button class="close-help-btn">Close</button>
        </div>
      `;

      document.body.appendChild(helpModal);

      // Add close functionality
      helpModal
        .querySelector(".close-help-btn")
        .addEventListener("click", () => {
          helpModal.remove();
        });
    } else {
      message =
        "Microphone permissions are granted. If you're still having issues, try refreshing the page or checking your device's sound settings.";
      this.showNotification(message, "success", 5000);
    }
  }

  // Detect browser and version
  detectBrowser() {
    const userAgent = navigator.userAgent;
    let browser = "Unknown";
    let version = "Unknown";

    // Chrome
    if (/Chrome/.test(userAgent) && !/Chromium|Edge|Edg/.test(userAgent)) {
      browser = "Chrome";
      version = userAgent.match(/Chrome\/(\d+\.\d+)/)?.[1] || "Unknown";
    }
    // Firefox
    else if (/Firefox/.test(userAgent)) {
      browser = "Firefox";
      version = userAgent.match(/Firefox\/(\d+\.\d+)/)?.[1] || "Unknown";
    }
    // Edge (Chromium-based)
    else if (/Edg/.test(userAgent)) {
      browser = "Edge";
      version = userAgent.match(/Edg\/(\d+\.\d+)/)?.[1] || "Unknown";
    }
    // Safari
    else if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) {
      browser = "Safari";
      version = userAgent.match(/Version\/(\d+\.\d+)/)?.[1] || "Unknown";
    }
    // Internet Explorer
    else if (/MSIE|Trident/.test(userAgent)) {
      browser = "Internet Explorer";
      version =
        userAgent.match(/MSIE (\d+\.\d+)/) ||
        userAgent.match(/rv:(\d+\.\d+)/)?.[1] ||
        "Unknown";
    }

    return { browser, version };
  }

  // Check browser compatibility
  checkBrowserCompatibility() {
    // Check if we're on localhost or 127.0.0.1 (these are always considered secure for WebRTC)
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    // For localhost, we don't need HTTPS
    if (isLocalhost) {
      return {
        hasWebRTC: true,
        isSecureContext: true,
        isCompatible: true,
      };
    }

    // For all other hosts, check for secure context
    const isSecureContext =
      window.isSecureContext === true || window.location.protocol === "https:";

    return {
      hasWebRTC: true, // Assume WebRTC is supported by default
      isSecureContext,
      isCompatible: isSecureContext,
    };
  }

  // Get user media with fallback for older browsers
  async getUserMediaWithFallback(constraints) {
    try {
      // Modern approach
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        return await navigator.mediaDevices.getUserMedia(constraints);
      }

      // Legacy approach
      const getUserMedia =
        navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia;

      if (!getUserMedia) {
        // Last resort: try to access the media directly
        if (navigator.mediaDevices) {
          return await navigator.mediaDevices.getUserMedia(constraints);
        }
        throw new Error("getUserMedia is not supported in this browser");
      }

      // Wrap the legacy API in a promise
      return new Promise((resolve, reject) => {
        try {
          getUserMedia.call(navigator, constraints, resolve, reject);
        } catch (err) {
          reject(err);
        }
      });
    } catch (err) {
      console.error("Error accessing media devices:", err);
      throw err;
    }
  }

  // Voice Chat Methods
  async joinVoiceChannel(channelName) {
    if (this.inVoiceChat) {
      this.leaveVoiceChannel();
    }

    try {
      console.log(`Attempting to join voice channel: ${channelName}`);

      // Check if we're on localhost (always considered secure)
      const isLocalhost =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";

      // Check browser compatibility first
      const compatibility = this.checkBrowserCompatibility();
      if (!compatibility.isCompatible && !isLocalhost) {
        let errorMessage = "Your browser doesn't support voice chat. ";

        if (!compatibility.hasWebRTC) {
          errorMessage +=
            "WebRTC is not supported. Please use Chrome, Firefox, or Edge.";
        } else if (!compatibility.isSecureContext) {
          errorMessage += "Voice chat requires a secure connection (HTTPS).";
        }

        this.showNotification(errorMessage, "error");
        console.error("Browser compatibility issue:", compatibility);
        return;
      }

      // First check permissions
      const permissionStatus = await this.checkMicrophonePermission();
      if (!permissionStatus.granted) {
        this.showNotification(permissionStatus.message, "error");

        // Show help button
        const helpButton = document.createElement("button");
        helpButton.className = "help-button";
        helpButton.textContent = "Microphone Troubleshooting";
        helpButton.onclick = () => this.troubleshootMicrophonePermissions();

        // Find the voice button for this channel
        const channelElement = document.querySelector(
          `[data-channel="${channelName}"]`
        );
        if (channelElement) {
          const voiceBtn = channelElement.querySelector(".voice-btn");
          if (voiceBtn) {
            // Insert help button after the voice button
            voiceBtn.parentNode.insertBefore(helpButton, voiceBtn.nextSibling);

            // Remove after 10 seconds
            setTimeout(() => {
              helpButton.remove();
            }, 10000);
          }
        }
        return;
      }

      // Request audio for actual use with fallback
      try {
        this.localStream = await this.getUserMediaWithFallback({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        console.log("Microphone access granted:", this.localStream);

        // Check if we actually got audio tracks
        const audioTracks = this.localStream.getAudioTracks();
        if (audioTracks.length === 0) {
          throw new Error("No audio tracks found in the media stream");
        }

        // Log audio track details
        audioTracks.forEach((track) => {
          console.log(
            "Audio track:",
            track.label,
            "enabled:",
            track.enabled,
            "muted:",
            track.muted
          );

          // Make sure track is enabled
          track.enabled = true;

          // Listen for track ended events
          track.onended = () => {
            console.log("Audio track ended:", track.label);
            this.showNotification(
              "Audio track ended unexpectedly. Try rejoining the voice channel.",
              "error"
            );
          };

          // Listen for track mute events
          track.onmute = () => {
            console.log("Audio track muted:", track.label);
            if (!this.isMuted) {
              track.enabled = true;
            }
          };
        });
      } catch (mediaError) {
        console.error("Error getting user media:", mediaError);
        this.showNotification(
          `Could not access microphone: ${
            mediaError.message || mediaError.name || "unknown error"
          }`,
          "error"
        );
        return;
      }

      // Update UI and state
      this.inVoiceChat = true;
      this.voiceChannel = channelName;

      document.getElementById("voiceStatus").style.display = "flex";
      document.getElementById("leaveVoiceBtn").style.display = "block";
      document.getElementById(
        "userStatus"
      ).textContent = `In voice - ${channelName}`;

      // Add troubleshoot button to voice controls
      const voiceControls = document.getElementById("voiceControls");
      if (voiceControls && !document.getElementById("troubleshootBtn")) {
        const troubleshootBtn = document.createElement("button");
        troubleshootBtn.id = "troubleshootBtn";
        troubleshootBtn.className = "voice-control-btn";
        troubleshootBtn.title = "Troubleshoot microphone";
        troubleshootBtn.innerHTML = "🔍";
        troubleshootBtn.addEventListener("click", () =>
          this.troubleshootMicrophonePermissions()
        );
        voiceControls.appendChild(troubleshootBtn);
      }

      // Add visual indicator to the channel
      document.querySelectorAll(".channel").forEach((channel) => {
        if (channel.dataset.channel === channelName) {
          channel.classList.add("voice-active");
        }
      });

      // Initialize voice participants count to 1 (just self)
      this.updateVoiceParticipantsCount(1);

      // Notify server
      this.socket.emit("joinVoiceChannel", { channelName });

      // Show notification
      this.showNotification(`Connected to voice in #${channelName}`);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      this.showNotification(
        "Could not access microphone. Please check permissions.",
        "error"
      );

      // Add troubleshooting button
      const helpButton = document.createElement("button");
      helpButton.className = "help-button";
      helpButton.textContent = "Microphone Troubleshooting";
      helpButton.onclick = () => this.troubleshootMicrophonePermissions();

      // Add to notification area
      const notificationArea =
        document.getElementById("notificationArea") || document.body;
      notificationArea.appendChild(helpButton);

      // Remove after 10 seconds
      setTimeout(() => {
        helpButton.remove();
      }, 10000);
    }
  }

  leaveVoiceChannel() {
    if (!this.inVoiceChat) return;

    console.log("Leaving voice channel");

    // Clean up WebRTC connections
    this.peerConnections.forEach((pc, userId) => {
      console.log(`Closing connection with user ${userId}`);
      pc.close();
    });
    this.peerConnections.clear();

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        console.log("Stopping track:", track.kind);
        track.stop();
      });
      this.localStream = null;
    }

    // Update state
    this.inVoiceChat = false;
    this.isMuted = false;
    this.isDeafened = false;

    // Update UI
    document.getElementById("voiceStatus").style.display = "none";
    document.getElementById("leaveVoiceBtn").style.display = "none";
    document.getElementById("userStatus").textContent = "Online";
    document.getElementById("muteBtn").textContent = "🎤";
    document.getElementById("muteBtn").classList.remove("muted");
    document.getElementById("deafenBtn").textContent = "🔊";
    document.getElementById("deafenBtn").classList.remove("muted");

    // Remove visual indicators
    document.querySelectorAll(".channel").forEach((channel) => {
      channel.classList.remove("voice-active");
    });

    // Remove audio elements
    document
      .querySelectorAll('audio[id^="audio-"]')
      .forEach((el) => el.remove());

    // Notify server
    this.socket.emit("leaveVoiceChannel");

    // Show notification
    this.showNotification("Disconnected from voice chat");
  }

  toggleMute() {
    if (!this.localStream) return;

    this.isMuted = !this.isMuted;
    console.log(`Microphone ${this.isMuted ? "muted" : "unmuted"}`);

    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !this.isMuted;
    });

    const muteBtn = document.getElementById("muteBtn");
    muteBtn.classList.toggle("muted", this.isMuted);
    muteBtn.textContent = this.isMuted ? "🚫" : "🎤";

    this.showNotification(`Microphone ${this.isMuted ? "muted" : "unmuted"}`);
  }

  toggleDeafen() {
    this.isDeafened = !this.isDeafened;
    console.log(`Audio ${this.isDeafened ? "deafened" : "undeafened"}`);

    // Mute all remote audio elements
    document.querySelectorAll('audio[id^="audio-"]').forEach((audio) => {
      audio.muted = this.isDeafened;
    });

    const deafenBtn = document.getElementById("deafenBtn");
    deafenBtn.classList.toggle("muted", this.isDeafened);
    deafenBtn.textContent = this.isDeafened ? "🔇" : "🔊";

    this.showNotification(
      `Audio ${this.isDeafened ? "deafened" : "undeafened"}`
    );
  }

  async onVoiceChannelJoined(data) {
    console.log("Voice channel joined:", data);
    document.getElementById("voiceStatus").style.display = "flex";
    document.getElementById("leaveVoiceBtn").style.display = "block";
    document.getElementById(
      "userStatus"
    ).textContent = `In voice - ${data.channel.name}`;

    // Update voice participants count
    this.updateVoiceParticipantsCount(data.users.length + 1); // +1 for self

    // Create peer connections for existing users
    console.log(`Creating connections for ${data.users.length} existing users`);

    // Add a small delay to ensure all users are ready
    setTimeout(async () => {
      for (const user of data.users) {
        if (user.userId !== this.currentUser.id) {
          console.log(
            `Initiating connection with user ${user.userId} (${user.username})`
          );
          await this.createPeerConnection(user.userId);
        }
      }
    }, 1000); // 1 second delay
  }

  async onUserJoinedVoice(data) {
    console.log(`User joined voice: ${data.username} (${data.userId})`);
    if (data.userId !== this.currentUser.id) {
      await this.createPeerConnection(data.userId);
      this.showNotification(`${data.username} joined the voice channel`);

      // Update voice participants count
      const count = document.getElementById("voiceParticipantsCount");
      if (count) {
        count.textContent = parseInt(count.textContent || "1") + 1;
      }
    }
  }

  onUserLeftVoice(data) {
    console.log(`User left voice: ${data.username} (${data.userId})`);
    const pc = this.peerConnections.get(data.userId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(data.userId);

      // Remove audio element
      const audioElement = document.getElementById(`audio-${data.userId}`);
      if (audioElement) {
        audioElement.remove();
      }

      this.showNotification(`${data.username} left the voice channel`);

      // Update voice participants count
      const count = document.getElementById("voiceParticipantsCount");
      if (count) {
        const newCount = Math.max(1, parseInt(count.textContent || "2") - 1);
        count.textContent = newCount;
      }
    }
  }

  async createPeerConnection(userId) {
    try {
      console.log(`Creating peer connection for user ${userId}`);

      // Create RTCPeerConnection with ICE servers
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" },
        ],
        iceCandidatePoolSize: 10,
      });
      this.peerConnections.set(userId, pc);

      // Add local stream tracks to the connection
      if (this.localStream) {
        console.log("Adding local stream tracks to connection");
        this.localStream.getTracks().forEach((track) => {
          console.log(`Adding track to peer connection: ${track.kind}`);
          pc.addTrack(track, this.localStream);
        });
      }

      // Handle incoming remote streams
      pc.ontrack = (event) => {
        console.log(`Received track from user ${userId}:`, event.track.kind);

        // Create or update audio element for this user
        let remoteAudio = document.getElementById(`audio-${userId}`);

        if (!remoteAudio) {
          console.log("Creating new audio element");
          remoteAudio = document.createElement("audio");
          remoteAudio.id = `audio-${userId}`;
          remoteAudio.autoplay = true;
          remoteAudio.controls = true; // Add controls for debugging
          remoteAudio.muted = this.isDeafened;
          remoteAudio.style.display = "block"; // Make visible for debugging
          remoteAudio.volume = 1.0; // Ensure volume is up
          document.body.appendChild(remoteAudio);
        }

        // Set the stream as the source
        if (remoteAudio.srcObject !== event.streams[0]) {
          remoteAudio.srcObject = event.streams[0];
          console.log("Set remote stream to audio element");

          // Add event listeners for debugging
          remoteAudio.onloadedmetadata = () => {
            console.log("Remote audio metadata loaded, playing...");
            remoteAudio
              .play()
              .catch((e) => console.error("Error playing remote audio:", e));
          };

          event.streams[0].onaddtrack = (e) => {
            console.log("Track added to remote stream:", e.track.kind);
          };
        }
      };

      // Log connection state changes
      pc.onconnectionstatechange = () => {
        console.log(
          `Connection state for user ${userId}: ${pc.connectionState}`
        );

        // Update UI based on connection state
        switch (pc.connectionState) {
          case "connected":
            this.showNotification(
              `Voice connection established with user ${userId}`,
              "success"
            );
            break;
          case "disconnected":
          case "failed":
            console.log("Connection failed, attempting to reconnect...");
            this.showNotification(
              `Voice connection with user ${userId} lost. Reconnecting...`,
              "error"
            );

            // Close the old connection
            pc.close();
            this.peerConnections.delete(userId);

            // Try to establish a new connection after a short delay
            setTimeout(() => {
              if (this.inVoiceChat) {
                this.createPeerConnection(userId);
              }
            }, 2000);
            break;
        }
      };

      // Log ICE connection state changes
      pc.oniceconnectionstatechange = () => {
        console.log(
          `ICE connection state for user ${userId}: ${pc.iceConnectionState}`
        );

        // Handle ICE connection failures
        if (pc.iceConnectionState === "failed") {
          console.log("ICE connection failed, attempting to restart");

          // Try using relay servers only as a fallback
          pc.getConfiguration().iceTransportPolicy = "relay";

          // Restart ICE if possible
          if (pc.restartIce) {
            console.log("Attempting ICE restart");
            pc.restartIce();
          }
        }
      };

      // Track ICE gathering state
      pc.onicegatheringstatechange = () => {
        console.log(`ICE gathering state: ${pc.iceGatheringState}`);
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("Sending ICE candidate to user", userId);
          this.socket.emit("webrtc-ice-candidate", {
            targetUserId: userId,
            candidate: event.candidate,
          });
        }
      };

      // Create and send offer if we're the initiator
      // We'll determine who initiates based on user ID comparison to avoid both sides creating offers
      if (this.currentUser.id < userId) {
        console.log(`Initiating offer to user ${userId}`);
        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            voiceActivityDetection: true,
            iceRestart: true,
          });

          await pc.setLocalDescription(offer);

          console.log("Sending WebRTC offer");
          this.socket.emit("webrtc-offer", {
            targetUserId: userId,
            offer: pc.localDescription,
          });
        } catch (error) {
          console.error("Error creating offer:", error);
        }
      } else {
        console.log(`Waiting for offer from user ${userId}`);
      }

      return pc;
    } catch (error) {
      console.error("Error creating peer connection:", error);
      return null;
    }
  }

  async handleWebRTCOffer(data) {
    try {
      console.log(`Received WebRTC offer from user ${data.fromUserId}`);

      // Get or create peer connection
      let pc = this.peerConnections.get(data.fromUserId);

      if (!pc) {
        console.log("Creating new peer connection for offer");
        pc = await this.createPeerConnection(data.fromUserId);
      }

      if (!pc) {
        console.error("Failed to create peer connection");
        return;
      }

      // If we already have a remote description, ignore this offer
      if (pc.remoteDescription && pc.remoteDescription.type) {
        console.log("Already have remote description, ignoring offer");
        return;
      }

      // Set the remote description from the offer
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        console.log("Set remote description from offer");
      } catch (error) {
        console.error("Error setting remote description:", error);
        return;
      }

      // Create and set local description (answer)
      try {
        const answer = await pc.createAnswer({
          offerToReceiveAudio: true,
        });
        await pc.setLocalDescription(answer);
        console.log("Created and set local answer");
      } catch (error) {
        console.error("Error creating answer:", error);
        return;
      }

      // Send the answer back
      this.socket.emit("webrtc-answer", {
        targetUserId: data.fromUserId,
        answer: pc.localDescription,
      });
      console.log("Sent answer to user", data.fromUserId);
    } catch (error) {
      console.error("Error handling WebRTC offer:", error);
    }
  }

  async handleWebRTCAnswer(data) {
    try {
      console.log(`Received WebRTC answer from user ${data.fromUserId}`);
      const pc = this.peerConnections.get(data.fromUserId);

      if (pc) {
        // Only set remote description if we don't already have one
        if (!pc.remoteDescription || !pc.remoteDescription.type) {
          try {
            await pc.setRemoteDescription(
              new RTCSessionDescription(data.answer)
            );
            console.log("Set remote description from answer");
          } catch (error) {
            console.error(
              "Error setting remote description from answer:",
              error
            );
          }
        } else {
          console.log("Already have remote description, ignoring answer");
        }
      } else {
        console.error("No peer connection found for user", data.fromUserId);
      }
    } catch (error) {
      console.error("Error handling WebRTC answer:", error);
    }
  }

  async handleWebRTCIceCandidate(data) {
    try {
      console.log(`Received ICE candidate from user ${data.fromUserId}`);
      const pc = this.peerConnections.get(data.fromUserId);

      if (pc) {
        try {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            console.log("Added ICE candidate");
          } else {
            console.log(
              "Received ICE candidate before remote description, queueing..."
            );

            // Store the candidate to add later
            if (!this._pendingCandidates) {
              this._pendingCandidates = new Map();
            }

            if (!this._pendingCandidates.has(data.fromUserId)) {
              this._pendingCandidates.set(data.fromUserId, []);
            }

            this._pendingCandidates.get(data.fromUserId).push(data.candidate);

            // Set up a handler to process pending candidates once we have the remote description
            const checkAndAddCandidates = () => {
              if (pc.remoteDescription) {
                const candidates =
                  this._pendingCandidates.get(data.fromUserId) || [];
                console.log(
                  `Adding ${candidates.length} queued ICE candidates`
                );

                candidates.forEach(async (candidate) => {
                  try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    console.log("Added queued ICE candidate");
                  } catch (err) {
                    console.error("Error adding queued ICE candidate:", err);
                  }
                });

                this._pendingCandidates.delete(data.fromUserId);
              } else {
                // Keep checking until we have the remote description
                setTimeout(checkAndAddCandidates, 500);
              }
            };

            checkAndAddCandidates();
          }
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      } else {
        console.error("No peer connection found for user", data.fromUserId);
      }
    } catch (error) {
      console.error("Error handling ICE candidate:", error);
    }
  }

  // Update voice participants count
  updateVoiceParticipantsCount(count) {
    const countElement = document.getElementById("voiceParticipantsCount");
    if (countElement) {
      countElement.textContent = count;
    }
  }

  // Emoji picker
  showEmojiPicker() {
    const emojiPicker = document.getElementById("emojiPicker");
    emojiPicker.classList.toggle("active");

    if (emojiPicker.classList.contains("active")) {
      this.populateEmojiCategory(this.currentEmojiCategory);
      document.addEventListener("click", this.handleOutsideEmojiClick);
    } else {
      document.removeEventListener("click", this.handleOutsideEmojiClick);
    }
  }

  handleOutsideEmojiClick = (e) => {
    const emojiPicker = document.getElementById("emojiPicker");
    const emojiButton = document.getElementById("emojiButton");

    if (!emojiPicker.contains(e.target) && e.target !== emojiButton) {
      emojiPicker.classList.remove("active");
      document.removeEventListener("click", this.handleOutsideEmojiClick);
    }
  };

  populateEmojiCategory(category) {
    const container = document.getElementById("emojiContainer");
    container.innerHTML = "";

    this.emojis[category].forEach((emoji) => {
      const emojiElement = document.createElement("div");
      emojiElement.classList.add("emoji-item");
      emojiElement.textContent = emoji;
      emojiElement.addEventListener("click", () => {
        this.insertEmoji(emoji);

        // Add to recent
        if (category !== "recent" && !this.emojis.recent.includes(emoji)) {
          this.emojis.recent.unshift(emoji);
          if (this.emojis.recent.length > 20) {
            this.emojis.recent.pop();
          }
        }
      });
      container.appendChild(emojiElement);
    });
  }

  searchEmojis(query) {
    if (!query) {
      this.populateEmojiCategory(this.currentEmojiCategory);
      return;
    }

    const container = document.getElementById("emojiContainer");
    container.innerHTML = "";

    const allEmojis = Object.values(this.emojis).flat();
    const filteredEmojis = [...new Set(allEmojis)].filter(
      (emoji) =>
        emoji.includes(query) ||
        this.getEmojiDescription(emoji).includes(query.toLowerCase())
    );

    filteredEmojis.forEach((emoji) => {
      const emojiElement = document.createElement("div");
      emojiElement.classList.add("emoji-item");
      emojiElement.textContent = emoji;
      emojiElement.addEventListener("click", () => {
        this.insertEmoji(emoji);
      });
      container.appendChild(emojiElement);
    });
  }

  getEmojiDescription(emoji) {
    // This is a simplified version - in a real app, you'd have a mapping of emojis to descriptions
    const descriptions = {
      "👍": "thumbs up like",
      "❤️": "heart love",
      "😊": "smile happy",
      "🙌": "raised hands celebrate",
      "👏": "clap applause",
      "🔥": "fire hot trending",
      "🎉": "party popper celebration",
      "💯": "hundred points perfect score",
    };

    return descriptions[emoji] || "";
  }

  // Message reactions
  showReactionPicker(messageId) {
    const emojiPicker = document.getElementById("emojiPicker");
    emojiPicker.classList.add("active");
    emojiPicker.dataset.reactionMessageId = messageId;

    const handleReactionSelect = (e) => {
      if (e.target.classList.contains("emoji-item")) {
        const emoji = e.target.textContent;
        this.addReaction(messageId, emoji);
        emojiPicker.classList.remove("active");
        emojiPicker.removeEventListener("click", handleReactionSelect);
        delete emojiPicker.dataset.reactionMessageId;
      }
    };

    emojiPicker.addEventListener("click", handleReactionSelect);

    this.populateEmojiCategory("recent");
  }

  addReaction(messageId, emoji) {
    if (this.inDmChat) {
      this.socket.emit("addDmReaction", {
        conversationId: this.currentDmConversation.id,
        messageId,
        emoji,
      });
    } else {
      this.socket.emit("addReaction", {
        channelName: this.currentChannel,
        messageId,
        emoji,
      });
    }
  }

  toggleReaction(messageId, emoji) {
    if (this.inDmChat) {
      this.socket.emit("toggleDmReaction", {
        conversationId: this.currentDmConversation.id,
        messageId,
        emoji,
      });
    } else {
      this.socket.emit("toggleReaction", {
        channelName: this.currentChannel,
        messageId,
        emoji,
      });
    }
  }

  // Message editing
  editMessage(messageId) {
    const messageElement = document.querySelector(
      `.message[data-id="${messageId}"]`
    );
    const messageText = messageElement.querySelector(".message-text");
    const originalContent = messageText.textContent;

    // Only allow editing your own messages
    if (
      !messageElement.dataset.userId ||
      messageElement.dataset.userId !== this.currentUser.id
    ) {
      return;
    }

    const inputElement = document.createElement("textarea");
    inputElement.classList.add("edit-message-input");
    inputElement.value = originalContent;

    messageText.innerHTML = "";
    messageText.appendChild(inputElement);
    inputElement.focus();

    const saveEdit = () => {
      const newContent = inputElement.value.trim();

      if (newContent && newContent !== originalContent) {
        if (this.inDmChat) {
          this.socket.emit("editDmMessage", {
            conversationId: this.currentDmConversation.id,
            messageId,
            content: newContent,
          });
        } else {
          this.socket.emit("editMessage", {
            channelName: this.currentChannel,
            messageId,
            content: newContent,
          });
        }
      } else {
        messageText.textContent = originalContent;
      }
    };

    inputElement.addEventListener("blur", saveEdit);
    inputElement.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        saveEdit();
      }
      if (e.key === "Escape") {
        messageText.textContent = originalContent;
      }
    });
  }

  // DM methods
  loadDmConversations() {
    this.socket.emit("getDMConversations");
  }

  loadAllUsers() {
    this.socket.emit("getAllUsers");
  }

  renderDmConversations(conversations) {
    const dmList = document.getElementById("dmList");
    dmList.innerHTML = "";

    // Store conversations in the map
    this.dmConversations.clear();
    conversations.forEach((conv) => {
      this.dmConversations.set(conv.id, conv);
    });

    // Render each conversation
    conversations.forEach((conv) => {
      const dmChannel = document.createElement("div");
      dmChannel.className = `dm-channel ${
        this.inDmChat && this.currentDmConversation?.id === conv.id
          ? "active"
          : ""
      }`;
      dmChannel.dataset.conversationId = conv.id;

      const avatar = document.createElement("div");
      avatar.className = "dm-avatar";
      avatar.style.background = conv.targetUser.color;
      avatar.textContent = conv.targetUser.username.charAt(0).toUpperCase();

      const status = document.createElement("div");
      status.className = "dm-status";
      // Hide status for offline users
      if (!conv.targetUser.isOnline) {
        status.style.backgroundColor = "#747f8d";
      }

      const username = document.createElement("div");
      username.className = "dm-username";
      username.textContent = conv.targetUser.username;

      // Add notification badge if exists
      if (conv.hasNotification) {
        const notification = document.createElement("div");
        notification.className = "dm-notification";
        notification.textContent = "1";
        dmChannel.appendChild(notification);
      }

      dmChannel.appendChild(avatar);
      dmChannel.appendChild(status);
      dmChannel.appendChild(username);

      dmChannel.addEventListener("click", () => {
        this.openDmConversation(conv.id);
      });

      dmList.appendChild(dmChannel);
    });
  }

  openDmConversation(conversationId) {
    this.socket.emit("switchToDM", { conversationId });
  }

  switchToDmConversation(conversation, messages) {
    // Update state
    this.inDmChat = true;
    this.currentDmConversation = conversation;

    // Update UI
    document
      .querySelectorAll(".channel, .dm-channel")
      .forEach((ch) => ch.classList.remove("active"));
    const dmChannel = document.querySelector(
      `.dm-channel[data-conversation-id="${conversation.id}"]`
    );
    if (dmChannel) {
      dmChannel.classList.add("active");

      // Remove notification badge if exists
      const badge = dmChannel.querySelector(".dm-notification");
      if (badge) {
        badge.remove();
      }

      // Update conversation in map to remove notification
      const conv = this.dmConversations.get(conversation.id);
      if (conv) {
        conv.hasNotification = false;
      }
    }

    // Update header
    document.getElementById("currentChannelIcon").textContent = "@";
    document.getElementById("currentChannelName").textContent =
      conversation.targetUser.username;
    document.getElementById(
      "messageInput"
    ).placeholder = `Message @${conversation.targetUser.username}`;

    // Render messages
    this.renderMessages(messages);
  }

  showDmNotification(conversationId) {
    // Update conversation in map
    const conv = this.dmConversations.get(conversationId);
    if (conv) {
      conv.hasNotification = true;
      this.renderDmConversations([...this.dmConversations.values()]);
    }
  }

  showNewDmModal() {
    document.getElementById("newDmModal").style.display = "flex";
    document.getElementById("dmUserSearch").focus();

    // Load all users first
    this.loadAllUsers();

    // Pre-populate search results with all users
    this.searchUsers("");
  }

  hideNewDmModal() {
    document.getElementById("newDmModal").style.display = "none";
    document.getElementById("dmUserSearch").value = "";
    document.getElementById("dmUserSearchResults").innerHTML = "";
  }

  searchUsers(query) {
    const resultsContainer = document.getElementById("dmUserSearchResults");
    resultsContainer.innerHTML = "";

    // Check if users are loaded
    if (!this.allUsers || this.allUsers.length === 0) {
      const loading = document.createElement("div");
      loading.className = "loading-message";
      loading.textContent = "Loading users...";
      resultsContainer.appendChild(loading);
      return;
    }

    // Filter users based on query
    const filteredUsers = this.allUsers.filter(
      (user) =>
        user.id !== this.currentUser.id &&
        user.username.toLowerCase().includes(query.toLowerCase())
    );

    if (filteredUsers.length === 0) {
      const noResults = document.createElement("div");
      noResults.className = "no-results";
      noResults.textContent = "No users found";
      resultsContainer.appendChild(noResults);
      return;
    }

    // Create user items
    filteredUsers.forEach((user) => {
      const userItem = document.createElement("div");
      userItem.className = "user-search-item";

      const avatar = document.createElement("div");
      avatar.className = "user-search-avatar";
      avatar.style.background = user.color;
      avatar.textContent = user.username.charAt(0).toUpperCase();

      const name = document.createElement("div");
      name.className = "user-search-name";
      name.textContent = user.username;

      userItem.appendChild(avatar);
      userItem.appendChild(name);

      userItem.addEventListener("click", () => {
        this.createDmConversation(user.id);
      });

      resultsContainer.appendChild(userItem);
    });
  }

  createDmConversation(targetUserId) {
    this.socket.emit("createDMConversation", { targetUserId });
    this.hideNewDmModal();
  }

  // Theme management
  loadThemePreference() {
    const savedTheme = localStorage.getItem("chatcord-theme");
    if (savedTheme) {
      this.isDarkTheme = savedTheme === "dark";
      this.applyTheme();
    }
  }

  toggleTheme() {
    this.isDarkTheme = !this.isDarkTheme;
    this.applyTheme();
    localStorage.setItem("chatcord-theme", this.isDarkTheme ? "dark" : "light");
  }

  applyTheme() {
    if (this.isDarkTheme) {
      document.body.classList.remove("light-theme");
      document.getElementById("themeToggle").textContent = "🌙";
    } else {
      document.body.classList.add("light-theme");
      document.getElementById("themeToggle").textContent = "☀️";
    }
  }

  insertEmoji(emoji) {
    const messageInput = document.getElementById("messageInput");
    const cursorPos = messageInput.selectionStart;
    const textBefore = messageInput.value.substring(0, cursorPos);
    const textAfter = messageInput.value.substring(cursorPos);

    messageInput.value = textBefore + emoji + textAfter;
    messageInput.focus();

    // Set cursor position after emoji
    messageInput.selectionStart = cursorPos + emoji.length;
    messageInput.selectionEnd = cursorPos + emoji.length;

    // Trigger input event for auto-resize
    messageInput.dispatchEvent(new Event("input"));
  }

  // Update message reactions in the UI
  updateMessageReactions(messageId, reactions) {
    const messageElement = document.querySelector(
      `.message[data-id="${messageId}"]`
    );
    if (!messageElement) return;

    // Remove existing reactions
    const existingReactions =
      messageElement.querySelector(".message-reactions");
    if (existingReactions) {
      existingReactions.remove();
    }

    // If no reactions, we're done
    if (!reactions || Object.keys(reactions).length === 0) return;

    // Create reactions container
    const reactionsContainer = document.createElement("div");
    reactionsContainer.classList.add("message-reactions");

    Object.entries(reactions).forEach(([emoji, users]) => {
      const reactionElement = document.createElement("div");
      reactionElement.classList.add("reaction");
      reactionElement.dataset.messageId = messageId;
      reactionElement.dataset.emoji = emoji;

      // Check if current user reacted with this emoji
      if (users.includes(this.currentUser.id)) {
        reactionElement.classList.add("active");
      }

      reactionElement.innerHTML = `${emoji} <span class="reaction-count">${users.length}</span>`;
      reactionsContainer.appendChild(reactionElement);
    });

    messageElement.appendChild(reactionsContainer);
  }

  // Update edited message in the UI
  updateEditedMessage(message) {
    const messageElement = document.querySelector(
      `.message[data-id="${message.id}"]`
    );
    if (!messageElement) return;

    // Update message content
    const messageText = messageElement.querySelector(".message-text");
    if (messageText) {
      messageText.textContent = message.content;

      // Add edited indicator if not already present
      if (
        message.edited_at &&
        !messageText.querySelector(".edited-indicator")
      ) {
        const editedIndicator = document.createElement("span");
        editedIndicator.classList.add("edited-indicator");
        editedIndicator.textContent = " (edited)";
        editedIndicator.style.fontSize = "0.8em";
        editedIndicator.style.opacity = "0.7";
        messageText.appendChild(editedIndicator);
      }
    }

    // Update reactions if any
    if (message.reactions) {
      this.updateMessageReactions(message.id, message.reactions);
    }
  }

  // Read receipt event
  updateReadReceipts(conversationId, readerId, readAt) {
    // Only update if we're in the same conversation and we're the sender
    if (
      this.inDmChat &&
      this.currentDmConversation &&
      this.currentDmConversation.id === conversationId &&
      readerId !== this.currentUser.id
    ) {
      // Find all messages sent by the current user
      const messages = document.querySelectorAll(
        `.message[data-user-id="${this.currentUser.id}"]`
      );

      messages.forEach((messageEl) => {
        // Add read indicator if not already present
        if (!messageEl.querySelector(".read-receipt")) {
          const messageContent = messageEl.querySelector(".message-content");

          const readReceipt = document.createElement("div");
          readReceipt.className = "read-receipt";
          readReceipt.title = `Read at ${new Date(
            readAt
          ).toLocaleTimeString()}`;
          readReceipt.innerHTML = "✓";

          messageContent.appendChild(readReceipt);
        }
      });
    }
  }
}

// Global functions for voice controls
function joinVoiceChannel(channelName) {
  window.chatApp.joinVoiceChannel(channelName);
}

function leaveVoiceChannel() {
  window.chatApp.leaveVoiceChannel();
}

function toggleMute() {
  window.chatApp.toggleMute();
}

function toggleDeafen() {
  window.chatApp.toggleDeafen();
}

// Initialize the chat app
window.chatApp = new ChatApp();
