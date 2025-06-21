const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Initialize SQLite Database
let dbInitialized = false;
const db = new sqlite3.Database("./chatcord.db", (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
  } else {
    console.log("Connected to SQLite database.");
    initializeDatabase();
  }
});

// Database Schema
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    // Enable foreign keys
    db.run("PRAGMA foreign_keys = ON;", (err) => {
      if (err) {
        console.error("Error enabling foreign keys:", err);
        return reject(err);
      }

      // Create tables in sequence to ensure dependencies are met
      db.serialize(() => {
        // Users table first (no dependencies)
        db.run(
          `CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    email TEXT UNIQUE,
                    password_hash TEXT,
                    color TEXT NOT NULL,
                    avatar_url TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                    is_online BOOLEAN DEFAULT 0
                )`,
          (err) => {
            if (err) console.error("Error creating users table:", err);
          }
        );

        // Channels table (no dependencies)
        db.run(
          `CREATE TABLE IF NOT EXISTS channels (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    description TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    is_voice_enabled BOOLEAN DEFAULT 1
                )`,
          (err) => {
            if (err) console.error("Error creating channels table:", err);
          }
        );

        // Messages table (depends on users and channels)
        db.run(
          `CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    channel_id INTEGER NOT NULL,
                    content TEXT NOT NULL,
                    message_type TEXT DEFAULT 'text',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    edited_at DATETIME,
                    is_deleted BOOLEAN DEFAULT 0,
                    FOREIGN KEY (user_id) REFERENCES users (id),
                    FOREIGN KEY (channel_id) REFERENCES channels (id)
                )`,
          (err) => {
            if (err) console.error("Error creating messages table:", err);
          }
        );

        // Message reactions table
        db.run(
          `CREATE TABLE IF NOT EXISTS message_reactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    message_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    emoji TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (message_id) REFERENCES messages (id),
                    FOREIGN KEY (user_id) REFERENCES users (id),
                    UNIQUE(message_id, user_id, emoji)
                )`,
          (err) => {
            if (err)
              console.error("Error creating message_reactions table:", err);
          }
        );

        // User sessions table (depends on users and channels)
        db.run(
          `CREATE TABLE IF NOT EXISTS user_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    socket_id TEXT UNIQUE NOT NULL,
                    current_channel_id INTEGER,
                    in_voice_chat BOOLEAN DEFAULT 0,
                    voice_channel_id INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id),
                    FOREIGN KEY (current_channel_id) REFERENCES channels (id),
                    FOREIGN KEY (voice_channel_id) REFERENCES channels (id)
                )`,
          (err) => {
            if (err) console.error("Error creating user_sessions table:", err);
          }
        );

        // Direct message conversations table
        db.run(
          `CREATE TABLE IF NOT EXISTS dm_conversations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user1_id INTEGER NOT NULL,
                    user2_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user1_id) REFERENCES users (id),
                    FOREIGN KEY (user2_id) REFERENCES users (id),
                    UNIQUE(user1_id, user2_id)
                )`,
          (err) => {
            if (err)
              console.error("Error creating dm_conversations table:", err);
          }
        );

        // Direct messages table
        db.run(
          `CREATE TABLE IF NOT EXISTS dm_messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id INTEGER NOT NULL,
                    sender_id INTEGER NOT NULL,
                    content TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    edited_at DATETIME,
                    read_at DATETIME,
                    is_deleted BOOLEAN DEFAULT 0,
                    FOREIGN KEY (conversation_id) REFERENCES dm_conversations (id),
                    FOREIGN KEY (sender_id) REFERENCES users (id)
                )`,
          (err) => {
            if (err) console.error("Error creating dm_messages table:", err);
          }
        );

        // DM message reactions table
        db.run(
          `CREATE TABLE IF NOT EXISTS dm_message_reactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    message_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    emoji TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (message_id) REFERENCES dm_messages (id),
                    FOREIGN KEY (user_id) REFERENCES users (id),
                    UNIQUE(message_id, user_id, emoji)
                )`,
          (err) => {
            if (err)
              console.error("Error creating dm_message_reactions table:", err);
          }
        );

        // Insert default data after tables are created
        insertDefaultData(() => {
          dbInitialized = true;
          console.log("Database initialized successfully.");
          resolve();
        });
      });
    });
  });
}

function insertDefaultData(callback) {
  // Insert default channels
  const defaultChannels = [
    { name: "general", description: "General discussion" },
    { name: "random", description: "Random chat" },
    { name: "gaming", description: "Gaming discussions" },
    { name: "music", description: "Music sharing and discussion" },
    { name: "coding", description: "Programming and development" },
  ];

  let channelsInserted = 0;
  const totalChannels = defaultChannels.length;

  defaultChannels.forEach((channel) => {
    db.run(
      `INSERT OR IGNORE INTO channels (name, description) VALUES (?, ?)`,
      [channel.name, channel.description],
      function (err) {
        if (err) {
          console.error("Error inserting channel:", err);
        }
        channelsInserted++;

        // When all channels are inserted, create bot user
        if (channelsInserted === totalChannels) {
          createBotUser(callback);
        }
      }
    );
  });
}

function createBotUser(callback) {
  // Create a bot user
  const botColor = "#72767d";
  const botPassword = bcrypt.hashSync("botpassword", 10);

  db.run(
    `INSERT OR IGNORE INTO users (username, color, password_hash) VALUES (?, ?, ?)`,
    ["ChatBot", botColor, botPassword],
    function (err) {
      if (err) {
        console.error("Error creating bot user:", err);
      }

      // Add initial bot messages
      addInitialBotMessages(callback);
    }
  );
}

function addInitialBotMessages(callback) {
  // Get bot user and channels
  db.get(
    "SELECT * FROM users WHERE username = ?",
    ["ChatBot"],
    (err, botUser) => {
      if (err || !botUser) {
        console.error("Error getting bot user:", err);
        return callback();
      }

      db.all("SELECT * FROM channels", (err, channels) => {
        if (err || !channels.length) {
          console.error("Error getting channels:", err);
          return callback();
        }

        const botMessages = [
          {
            channel: "general",
            text: "Welcome to ChatCord! 🚀 Now with persistent message history!",
          },
          { channel: "gaming", text: "Ready for some gaming sessions? 🎮" },
          { channel: "music", text: "Share your favorite tunes here! 🎵" },
          {
            channel: "coding",
            text: "Let's code together! Share your projects 💻",
          },
        ];

        let messagesInserted = 0;
        const totalMessages = botMessages.length;

        botMessages.forEach((msg) => {
          const channel = channels.find((c) => c.name === msg.channel);
          if (channel) {
            // Check if message already exists to avoid duplicates
            db.get(
              "SELECT * FROM messages WHERE user_id = ? AND channel_id = ? AND content = ?",
              [botUser.id, channel.id, msg.text],
              (err, existingMsg) => {
                if (!err && !existingMsg) {
                  db.run(
                    "INSERT INTO messages (user_id, channel_id, content) VALUES (?, ?, ?)",
                    [botUser.id, channel.id, msg.text],
                    (err) => {
                      if (err)
                        console.error("Error inserting bot message:", err);
                    }
                  );
                }

                messagesInserted++;
                if (messagesInserted === totalMessages) {
                  console.log("Initial bot messages added to database.");
                  callback();
                }
              }
            );
          } else {
            messagesInserted++;
            if (messagesInserted === totalMessages) {
              callback();
            }
          }
        });
      });
    }
  );
}

// In-memory storage for active connections
const activeUsers = new Map(); // socket.id -> user session data
const typingUsers = new Map(); // channelId -> Set of userIds

// User colors for consistent avatar colors
const userColors = [
  "#5865f2",
  "#57f287",
  "#fee75c",
  "#eb459e",
  "#ed4245",
  "#f1c40f",
  "#e67e22",
  "#e91e63",
  "#9c27b0",
  "#673ab7",
  "#3f51b5",
  "#2196f3",
  "#03a9f4",
  "#00bcd4",
  "#009688",
  "#4caf50",
  "#8bc34a",
  "#cddc39",
  "#ff9800",
  "#ff5722",
];

function getUserColor(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return userColors[Math.abs(hash) % userColors.length];
}

// Database helper functions
const dbAsync = {
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      if (!dbInitialized) {
        reject(new Error("Database not initialized"));
        return;
      }
      db.run(sql, params, function (err) {
        if (err) {
          console.error("Database run error:", err);
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  },

  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      if (!dbInitialized) {
        reject(new Error("Database not initialized"));
        return;
      }
      db.get(sql, params, (err, row) => {
        if (err) {
          console.error("Database get error:", err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  },

  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      if (!dbInitialized) {
        reject(new Error("Database not initialized"));
        return;
      }
      db.all(sql, params, (err, rows) => {
        if (err) {
          console.error("Database all error:", err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  },
};

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log(`New client connected: ${socket.id}`);
  let currentUser = null;
  let currentSession = null;

  // Check if database is initialized
  if (!dbInitialized) {
    socket.emit("joinError", {
      message: "Server is still initializing. Please try again in a moment.",
    });
    return;
  }

  // User joins with username
  socket.on("join", async ({ username, password, isLogin }) => {
    try {
      let user = await dbAsync.get("SELECT * FROM users WHERE username = ?", [
        username.trim(),
      ]);

      if (isLogin) {
        // LOGIN MODE: User is trying to log in to existing account
        if (!user) {
          socket.emit("joinError", {
            message:
              "Username not found. Please check your username or create a new account.",
          });
          return;
        }

        if (!user.password_hash) {
          socket.emit("joinError", {
            message:
              "This account has no password set. Please use the register tab.",
          });
          return;
        }

        if (!password) {
          socket.emit("joinError", {
            message: "Password is required for this account.",
          });
          return;
        }

        const validPassword = bcrypt.compareSync(password, user.password_hash);
        if (!validPassword) {
          socket.emit("joinError", {
            message: "Incorrect password. Please try again.",
          });
          return;
        }

        console.log(`${username} logged in successfully`);
      } else {
        // REGISTER MODE: User is creating new account or joining without password
        if (user) {
          if (user.password_hash) {
            socket.emit("joinError", {
              message:
                "Username already exists with a password. Please use the login tab.",
            });
            return;
          } else if (password) {
            // User wants to add password to existing account
            const hashedPassword = bcrypt.hashSync(password, 10);
            await dbAsync.run(
              "UPDATE users SET password_hash = ? WHERE id = ?",
              [hashedPassword, user.id]
            );
            user.password_hash = hashedPassword;
            console.log(`${username} added password to existing account`);
          }
        } else {
          // Create completely new user
          const color = getUserColor(username);
          const hashedPassword = password
            ? bcrypt.hashSync(password, 10)
            : null;

          const result = await dbAsync.run(
            "INSERT INTO users (username, color, password_hash) VALUES (?, ?, ?)",
            [username.trim(), color, hashedPassword]
          );

          user = await dbAsync.get("SELECT * FROM users WHERE id = ?", [
            result.id,
          ]);
          console.log(
            `${username} created new account ${
              password ? "with" : "without"
            } password`
          );
        }
      }

      // Rest of the join logic remains the same...
      // Update user online status
      await dbAsync.run(
        "UPDATE users SET is_online = 1, last_seen = CURRENT_TIMESTAMP WHERE id = ?",
        [user.id]
      );

      // Get default channel (general)
      const defaultChannel = await dbAsync.get(
        "SELECT * FROM channels WHERE name = ?",
        ["general"]
      );

      // Create user session
      await dbAsync.run(
        "INSERT INTO user_sessions (user_id, socket_id, current_channel_id) VALUES (?, ?, ?)",
        [user.id, socket.id, defaultChannel.id]
      );

      // Store active user data
      const userSession = {
        id: user.id,
        username: user.username,
        color: user.color,
        socketId: socket.id,
        currentChannelId: defaultChannel.id,
        inVoiceChat: false,
        voiceChannelId: null,
      };

      activeUsers.set(socket.id, userSession);

      // Join default channel room
      socket.join(`channel_${defaultChannel.id}`);

      // Get recent messages for the channel
      const messages = await getChannelMessages(defaultChannel.id);

      // Get online users in the channel
      const channelUsers = await getChannelUsers(defaultChannel.id);

      // Notify others in channel about new user
      socket.to(`channel_${defaultChannel.id}`).emit("userJoined", {
        username: user.username,
        userId: user.id,
      });

      // Send user their info and channel data
      socket.emit("joinSuccess", {
        user: userSession,
        channel: defaultChannel,
        messages: messages,
        users: channelUsers,
      });

      // Also send the user's DM conversations
      const dmConversations = await getUserDMConversations(user.id);
      socket.emit("dmConversations", dmConversations);

      // Send updated user list to all users in channel
      io.to(`channel_${defaultChannel.id}`).emit(
        "updateUserList",
        channelUsers
      );
    } catch (error) {
      console.error("Error during user join:", error);
      socket.emit("joinError", { message: "Server error. Please try again." });
    }
  });

  // Handle channel switching
  socket.on("switchChannel", async ({ channelName }) => {
    const userSession = activeUsers.get(socket.id);
    if (!userSession) return;

    try {
      const newChannel = await dbAsync.get(
        "SELECT * FROM channels WHERE name = ?",
        [channelName]
      );

      if (!newChannel) return;

      const oldChannelId = userSession.currentChannelId;

      // Leave old channel room
      socket.leave(`channel_${oldChannelId}`);

      // Join new channel room
      socket.join(`channel_${newChannel.id}`);

      // Update user session
      userSession.currentChannelId = newChannel.id;
      await dbAsync.run(
        "UPDATE user_sessions SET current_channel_id = ? WHERE socket_id = ?",
        [newChannel.id, socket.id]
      );

      // Get channel data
      const messages = await getChannelMessages(newChannel.id);
      const users = await getChannelUsers(newChannel.id);

      // Send channel data to user
      socket.emit("channelSwitched", {
        channel: newChannel,
        messages: messages,
        users: users,
      });

      // Update user lists in both channels
      const oldChannelUsers = await getChannelUsers(oldChannelId);
      const newChannelUsers = await getChannelUsers(newChannel.id);

      io.to(`channel_${oldChannelId}`).emit("updateUserList", oldChannelUsers);
      io.to(`channel_${newChannel.id}`).emit("updateUserList", newChannelUsers);
    } catch (error) {
      console.error("Error switching channel:", error);
    }
  });

  // Handle new messages
  socket.on(
    "sendMessage",
    async ({ text, channelName, isDM, targetUserId }) => {
      const userSession = activeUsers.get(socket.id);
      if (!userSession) return;

      try {
        if (isDM && targetUserId) {
          // Handle direct message
          await handleDirectMessage(
            userSession,
            targetUserId,
            text.trim(),
            socket,
            io
          );
        } else {
          // Handle regular channel message
          const channel = await dbAsync.get(
            "SELECT * FROM channels WHERE name = ?",
            [channelName]
          );

          if (!channel) return;

          // Save message to database
          const result = await dbAsync.run(
            "INSERT INTO messages (user_id, channel_id, content) VALUES (?, ?, ?)",
            [userSession.id, channel.id, text.trim()]
          );

          // Create message object with the correct format
          const message = {
            id: result.id,
            content: text.trim(),
            created_at: new Date().toISOString(),
            user: {
              id: userSession.id,
              username: userSession.username,
              color: userSession.color,
            },
            reactions: {},
          };

          // Broadcast message to all users in channel
          io.to(`channel_${channel.id}`).emit("newMessage", message);
        }
      } catch (error) {
        console.error("Error sending message:", error);
      }
    }
  );

  // Handle typing indicators
  socket.on("typing", ({ channelName }) => {
    const userSession = activeUsers.get(socket.id);
    if (!userSession) return;

    socket.to(`channel_${userSession.currentChannelId}`).emit("userTyping", {
      username: userSession.username,
      userId: userSession.id,
    });
  });

  socket.on("stopTyping", ({ channelName }) => {
    const userSession = activeUsers.get(socket.id);
    if (!userSession) return;

    socket
      .to(`channel_${userSession.currentChannelId}`)
      .emit("userStoppedTyping", {
        userId: userSession.id,
      });
  });

  // Create or get DM conversation
  socket.on("createDMConversation", async ({ targetUserId }) => {
    const userSession = activeUsers.get(socket.id);
    if (!userSession) return;

    try {
      const conversation = await getOrCreateDMConversation(
        userSession.id,
        targetUserId
      );
      const messages = await getDMMessages(conversation.id);

      // Get target user info
      const targetUser = await dbAsync.get("SELECT * FROM users WHERE id = ?", [
        targetUserId,
      ]);

      if (targetUser) {
        socket.emit("dmConversationCreated", {
          conversation: {
            id: conversation.id,
            targetUser: {
              id: targetUser.id,
              username: targetUser.username,
              color: targetUser.color,
            },
          },
          messages: messages,
        });
      }
    } catch (error) {
      console.error("Error creating DM conversation:", error);
    }
  });

  // Switch to DM conversation
  socket.on("switchToDM", async ({ conversationId }) => {
    const userSession = activeUsers.get(socket.id);
    if (!userSession) return;

    try {
      // Verify user is part of this conversation
      const conversation = await dbAsync.get(
        "SELECT * FROM dm_conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)",
        [conversationId, userSession.id, userSession.id]
      );

      if (!conversation) return;

      // Leave current channel
      if (userSession.currentChannelId) {
        socket.leave(`channel_${userSession.currentChannelId}`);
      }

      // Join DM room
      socket.join(`dm_${conversationId}`);

      // Update session
      userSession.currentChannelId = null;
      userSession.currentDMConversationId = conversationId;

      // Get messages and target user info
      const messages = await getDMMessages(conversationId);
      const targetUserId =
        conversation.user1_id === userSession.id
          ? conversation.user2_id
          : conversation.user1_id;
      const targetUser = await dbAsync.get("SELECT * FROM users WHERE id = ?", [
        targetUserId,
      ]);

      // Mark unread messages as read
      await markDmMessagesAsRead(conversationId, userSession.id);

      socket.emit("dmSwitched", {
        conversation: {
          id: conversationId,
          targetUser: {
            id: targetUser.id,
            username: targetUser.username,
            color: targetUser.color,
          },
        },
        messages: messages,
      });

      // Notify the other user that their messages have been read
      const targetSocketId = Array.from(activeUsers.entries()).find(
        ([socketId, user]) => user.id === targetUserId
      )?.[0];

      if (targetSocketId) {
        io.to(targetSocketId).emit("dmMessagesRead", {
          conversationId: conversationId,
          readerId: userSession.id,
          readAt: new Date().toISOString(),
        });
      }

      // Update user lists in previous channel
      if (userSession.currentChannelId) {
        const channelUsers = await getChannelUsers(
          userSession.currentChannelId
        );
        io.to(`channel_${userSession.currentChannelId}`).emit(
          "updateUserList",
          channelUsers
        );
      }
    } catch (error) {
      console.error("Error switching to DM:", error);
    }
  });

  // Get user's DM conversations
  socket.on("getDMConversations", async () => {
    try {
      const userSession = activeUsers.get(socket.id);
      if (!userSession) return;

      const conversations = await getUserDMConversations(userSession.id);
      socket.emit("dmConversations", conversations);
    } catch (error) {
      console.error("Error fetching DM conversations:", error);
    }
  });

  // Get all users for DM search
  socket.on("getAllUsers", async () => {
    const userSession = activeUsers.get(socket.id);
    if (!userSession) return;

    try {
      const users = await dbAsync.all(
        `
        SELECT id, username, color, is_online
        FROM users 
        WHERE username != 'ChatBot' AND id != ?
        ORDER BY is_online DESC, username
      `,
        [userSession.id]
      );

      socket.emit("allUsers", { users });
    } catch (error) {
      console.error("Error getting all users:", error);
    }
  });

  // Voice Chat - WebRTC Signaling
  socket.on("joinVoiceChannel", async ({ channelName }) => {
    const userSession = activeUsers.get(socket.id);
    if (!userSession) return;

    try {
      console.log(
        `User ${userSession.username} (${userSession.id}) joining voice channel: ${channelName}`
      );

      const channel = await dbAsync.get(
        "SELECT * FROM channels WHERE name = ?",
        [channelName]
      );

      if (!channel) {
        console.error(`Channel ${channelName} not found`);
        return;
      }

      // Leave current voice channel if in one
      if (userSession.inVoiceChat && userSession.voiceChannelId) {
        console.log(
          `User ${userSession.username} leaving voice channel ${userSession.voiceChannelId} to join ${channel.id}`
        );
        socket.leave(`voice_${userSession.voiceChannelId}`);
        socket.to(`voice_${userSession.voiceChannelId}`).emit("userLeftVoice", {
          userId: userSession.id,
          username: userSession.username,
        });
      }

      // Join new voice channel
      userSession.inVoiceChat = true;
      userSession.voiceChannelId = channel.id;
      socket.join(`voice_${channel.id}`);

      // Update database
      await dbAsync.run(
        "UPDATE user_sessions SET in_voice_chat = 1, voice_channel_id = ? WHERE socket_id = ?",
        [channel.id, socket.id]
      );

      // Notify others in voice channel
      socket.to(`voice_${channel.id}`).emit("userJoinedVoice", {
        userId: userSession.id,
        username: userSession.username,
      });

      // Get current voice users
      const voiceUsers = Array.from(activeUsers.values())
        .filter(
          (user) =>
            user.inVoiceChat &&
            user.voiceChannelId === channel.id &&
            user.id !== userSession.id
        )
        .map((user) => ({ userId: user.id, username: user.username }));

      console.log(
        `Voice channel ${channelName} has ${voiceUsers.length} other users`
      );

      socket.emit("voiceChannelJoined", {
        channel: channel,
        users: voiceUsers,
      });

      // Update user lists
      await updateAllChannelUserLists();
    } catch (error) {
      console.error("Error joining voice channel:", error);
    }
  });

  socket.on("leaveVoiceChannel", async () => {
    const userSession = activeUsers.get(socket.id);
    if (!userSession || !userSession.inVoiceChat) return;

    try {
      console.log(
        `User ${userSession.username} (${userSession.id}) leaving voice channel ${userSession.voiceChannelId}`
      );

      socket.leave(`voice_${userSession.voiceChannelId}`);
      socket.to(`voice_${userSession.voiceChannelId}`).emit("userLeftVoice", {
        userId: userSession.id,
        username: userSession.username,
      });

      // Update session
      const oldVoiceChannelId = userSession.voiceChannelId;
      userSession.inVoiceChat = false;
      userSession.voiceChannelId = null;

      // Update database
      await dbAsync.run(
        "UPDATE user_sessions SET in_voice_chat = 0, voice_channel_id = NULL WHERE socket_id = ?",
        [socket.id]
      );

      // Update user lists
      await updateAllChannelUserLists();
    } catch (error) {
      console.error("Error leaving voice channel:", error);
    }
  });

  // WebRTC signaling
  socket.on("webrtc-offer", ({ targetUserId, offer }) => {
    try {
      const targetSocketId = Array.from(activeUsers.entries()).find(
        ([socketId, user]) => user.id === targetUserId
      )?.[0];

      if (targetSocketId) {
        const fromUser = activeUsers.get(socket.id);
        console.log(
          `Forwarding WebRTC offer from ${fromUser?.username} (${fromUser?.id}) to ${targetUserId}`
        );

        socket.to(targetSocketId).emit("webrtc-offer", {
          fromUserId: fromUser?.id,
          offer,
        });
      } else {
        console.log(`Target user ${targetUserId} not found for WebRTC offer`);
      }
    } catch (error) {
      console.error("Error forwarding WebRTC offer:", error);
    }
  });

  socket.on("webrtc-answer", ({ targetUserId, answer }) => {
    try {
      const targetSocketId = Array.from(activeUsers.entries()).find(
        ([socketId, user]) => user.id === targetUserId
      )?.[0];

      if (targetSocketId) {
        const fromUser = activeUsers.get(socket.id);
        console.log(
          `Forwarding WebRTC answer from ${fromUser?.username} (${fromUser?.id}) to ${targetUserId}`
        );

        socket.to(targetSocketId).emit("webrtc-answer", {
          fromUserId: fromUser?.id,
          answer,
        });
      } else {
        console.log(`Target user ${targetUserId} not found for WebRTC answer`);
      }
    } catch (error) {
      console.error("Error forwarding WebRTC answer:", error);
    }
  });

  socket.on("webrtc-ice-candidate", ({ targetUserId, candidate }) => {
    try {
      const targetSocketId = Array.from(activeUsers.entries()).find(
        ([socketId, user]) => user.id === targetUserId
      )?.[0];

      if (targetSocketId) {
        const fromUser = activeUsers.get(socket.id);
        console.log(
          `Forwarding ICE candidate from ${fromUser?.username} (${fromUser?.id}) to ${targetUserId}`
        );

        socket.to(targetSocketId).emit("webrtc-ice-candidate", {
          fromUserId: fromUser?.id,
          candidate,
        });
      } else {
        console.log(`Target user ${targetUserId} not found for ICE candidate`);
      }
    } catch (error) {
      console.error("Error forwarding ICE candidate:", error);
    }
  });

  // Handle disconnection
  socket.on("disconnect", async () => {
    const userSession = activeUsers.get(socket.id);
    if (userSession) {
      try {
        // Update user offline status
        await dbAsync.run(
          "UPDATE users SET is_online = 0, last_seen = CURRENT_TIMESTAMP WHERE id = ?",
          [userSession.id]
        );

        // Remove user session
        await dbAsync.run("DELETE FROM user_sessions WHERE socket_id = ?", [
          socket.id,
        ]);

        // Notify channels
        socket.to(`channel_${userSession.currentChannelId}`).emit("userLeft", {
          username: userSession.username,
          userId: userSession.id,
        });

        // Notify voice channel if in one
        if (userSession.inVoiceChat && userSession.voiceChannelId) {
          socket
            .to(`voice_${userSession.voiceChannelId}`)
            .emit("userLeftVoice", {
              userId: userSession.id,
              username: userSession.username,
            });
        }

        activeUsers.delete(socket.id);
        await updateAllChannelUserLists();

        console.log(`${userSession.username} disconnected`);
      } catch (error) {
        console.error("Error during disconnect:", error);
      }
    }
  });

  // Add reaction to a message
  socket.on("addReaction", async (data) => {
    try {
      if (!currentUser) return;

      const { channelName, messageId, emoji } = data;

      // Get channel ID
      const channel = await new Promise((resolve, reject) => {
        db.get(
          "SELECT id FROM channels WHERE name = ?",
          [channelName],
          (err, row) => {
            if (err || !row) reject(err || new Error("Channel not found"));
            else resolve(row);
          }
        );
      });

      // Add reaction
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT OR IGNORE INTO message_reactions (message_id, user_id, emoji)
           VALUES (?, ?, ?)`,
          [messageId, currentUser.id, emoji],
          function (err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Get updated message with reactions
      const reactions = await getMessageReactions(messageId);

      // Broadcast to channel
      socket.to(channelName).emit("messageReactionUpdated", {
        messageId,
        reactions: reactions,
      });

      // Send to sender
      socket.emit("messageReactionUpdated", {
        messageId,
        reactions: reactions,
      });
    } catch (error) {
      console.error("Error adding reaction:", error);
    }
  });

  // Toggle reaction (add or remove)
  socket.on("toggleReaction", async (data) => {
    try {
      if (!currentUser) return;

      const { channelName, messageId, emoji } = data;

      // Check if reaction exists
      const existingReaction = await new Promise((resolve, reject) => {
        db.get(
          `SELECT id FROM message_reactions 
           WHERE message_id = ? AND user_id = ? AND emoji = ?`,
          [messageId, currentUser.id, emoji],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (existingReaction) {
        // Remove reaction
        await new Promise((resolve, reject) => {
          db.run(
            `DELETE FROM message_reactions 
             WHERE message_id = ? AND user_id = ? AND emoji = ?`,
            [messageId, currentUser.id, emoji],
            function (err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      } else {
        // Add reaction
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT OR IGNORE INTO message_reactions (message_id, user_id, emoji)
             VALUES (?, ?, ?)`,
            [messageId, currentUser.id, emoji],
            function (err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      // Get updated message with reactions
      const reactions = await getMessageReactions(messageId);

      // Broadcast to channel
      socket.to(channelName).emit("messageReactionUpdated", {
        messageId,
        reactions: reactions,
      });

      // Send to sender
      socket.emit("messageReactionUpdated", {
        messageId,
        reactions: reactions,
      });
    } catch (error) {
      console.error("Error toggling reaction:", error);
    }
  });

  // Edit message
  socket.on("editMessage", async (data) => {
    try {
      if (!currentUser) return;

      const { channelName, messageId, content } = data;

      // Verify message belongs to user
      const message = await new Promise((resolve, reject) => {
        db.get(
          "SELECT * FROM messages WHERE id = ?",
          [messageId],
          (err, row) => {
            if (err || !row) reject(err || new Error("Message not found"));
            else resolve(row);
          }
        );
      });

      if (message.user_id !== currentUser.id) {
        return socket.emit("error", {
          message: "You can only edit your own messages",
        });
      }

      // Update message
      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE messages SET content = ?, edited_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [content, messageId],
          function (err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Get updated message
      const updatedMessage = await new Promise((resolve, reject) => {
        db.get(
          `SELECT m.*, u.username, u.color
           FROM messages m
           JOIN users u ON m.user_id = u.id
           WHERE m.id = ?`,
          [messageId],
          async (err, row) => {
            if (err || !row) {
              return reject(err || new Error("Message not found"));
            }

            try {
              const reactions = await getMessageReactions(row.id);
              resolve({
                id: row.id,
                content: row.content,
                created_at: row.created_at,
                edited_at: row.edited_at,
                user: {
                  id: row.user_id,
                  username: row.username,
                  color: row.color,
                },
                reactions: reactions,
              });
            } catch (error) {
              reject(error);
            }
          }
        );
      });

      // Broadcast to channel
      socket.to(channelName).emit("messageEdited", updatedMessage);

      // Send to sender
      socket.emit("messageEdited", updatedMessage);
    } catch (error) {
      console.error("Error editing message:", error);
      socket.emit("error", { message: "Failed to edit message" });
    }
  });

  async function updateAllChannelUserLists() {
    try {
      const channels = await dbAsync.all("SELECT * FROM channels");

      for (const channel of channels) {
        const users = await getChannelUsers(channel.id);
        io.to(`channel_${channel.id}`).emit("updateUserList", users);
      }
    } catch (error) {
      console.error("Error updating user lists:", error);
    }
  }

  socket.on("getAllUsers", async () => {
    try {
      const userSession = activeUsers.get(socket.id);
      if (!userSession) return;

      const users = await dbAsync.all("SELECT id, username, color FROM users");
      socket.emit("allUsers", users);
    } catch (error) {
      console.error("Error fetching all users:", error);
    }
  });

  socket.on("createDMConversation", async (data) => {
    try {
      const userSession = activeUsers.get(socket.id);
      if (!userSession) return;

      const conversation = await getOrCreateDMConversation(
        userSession.id,
        data.targetUserId
      );
      const messages = await getDMMessages(conversation.id);
      const targetUser = await dbAsync.get("SELECT * FROM users WHERE id = ?", [
        data.targetUserId,
      ]);

      // Update session
      userSession.currentDMConversationId = conversation.id;
      activeUsers.set(socket.id, userSession);

      // Leave current channel if any
      if (userSession.currentChannel) {
        socket.leave(`channel_${userSession.currentChannel}`);
      }

      // Join DM room
      socket.join(`dm_${conversation.id}`);

      socket.emit("dmSwitched", {
        conversation: {
          id: conversation.id,
          targetUser: {
            id: targetUser.id,
            username: targetUser.username,
            color: targetUser.color,
            isOnline: Array.from(activeUsers.values()).some(
              (u) => u.id === targetUser.id
            ),
          },
        },
        messages,
      });
    } catch (error) {
      console.error("Error creating DM conversation:", error);
    }
  });

  socket.on("markDMRead", async (data) => {
    try {
      const userSession = activeUsers.get(socket.id);
      if (!userSession) return;

      const { conversationId } = data;

      // Verify user is part of this conversation
      const conversation = await dbAsync.get(
        "SELECT * FROM dm_conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)",
        [conversationId, userSession.id, userSession.id]
      );

      if (!conversation) return;

      // Mark messages as read
      const updatedCount = await markDmMessagesAsRead(
        conversationId,
        userSession.id
      );

      if (updatedCount > 0) {
        // Find the other user in the conversation
        const otherUserId =
          conversation.user1_id === userSession.id
            ? conversation.user2_id
            : conversation.user1_id;

        // Find the other user's socket if they're online
        const otherUserSocketId = Array.from(activeUsers.entries()).find(
          ([socketId, user]) => user.id === otherUserId
        )?.[0];

        // Notify the other user that their messages were read
        if (otherUserSocketId) {
          io.to(otherUserSocketId).emit("dmMessagesRead", {
            conversationId,
            readerId: userSession.id,
            readAt: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error("Error marking DM as read:", error);
    }
  });
});

// Database helper functions
async function getChannelMessages(channelId, limit = 50) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT m.*, u.username, u.color
       FROM messages m
       JOIN users u ON m.user_id = u.id
       WHERE m.channel_id = ? AND m.is_deleted = 0
       ORDER BY m.created_at DESC
       LIMIT ?`,
      [channelId, limit],
      async (err, rows) => {
        if (err) {
          console.error("Error getting messages:", err);
          return reject(err);
        }

        try {
          // Get reactions for each message
          const messages = [];
          for (const message of rows) {
            const reactions = await getMessageReactions(message.id);
            messages.push({
              id: message.id,
              content: message.content,
              created_at: message.created_at,
              edited_at: message.edited_at,
              user: {
                id: message.user_id,
                username: message.username,
                color: message.color,
              },
              reactions: reactions,
            });
          }

          resolve(messages.reverse()); // Reverse to get chronological order
        } catch (error) {
          console.error("Error processing messages:", error);
          reject(error);
        }
      }
    );
  });
}

async function getMessageReactions(messageId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT mr.emoji, mr.user_id
       FROM message_reactions mr
       WHERE mr.message_id = ?`,
      [messageId],
      (err, rows) => {
        if (err) {
          console.error("Error getting message reactions:", err);
          return reject(err);
        }

        // Group reactions by emoji
        const reactions = {};
        rows.forEach((row) => {
          if (!reactions[row.emoji]) {
            reactions[row.emoji] = [];
          }
          reactions[row.emoji].push(row.user_id);
        });

        resolve(reactions);
      }
    );
  });
}

async function getChannelUsers(channelId) {
  if (!dbInitialized) {
    console.error("Database not initialized when getting users");
    return [];
  }

  try {
    const users = await dbAsync.all(
      `
            SELECT DISTINCT u.id, u.username, u.color, us.in_voice_chat, us.voice_channel_id
            FROM users u
            JOIN user_sessions us ON u.id = us.user_id
            WHERE us.current_channel_id = ?
        `,
      [channelId]
    );

    return users.map((user) => ({
      id: user.id,
      username: user.username,
      color: user.color,
      inVoiceChat: user.in_voice_chat === 1,
      voiceChannel: user.voice_channel_id,
    }));
  } catch (error) {
    console.error("Error getting channel users:", error);
    return [];
  }
}

// DM Helper Functions
async function getOrCreateDMConversation(user1Id, user2Id) {
  try {
    // Ensure consistent ordering (smaller ID first)
    const [smallerId, largerId] =
      user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];

    // Try to find existing conversation
    let conversation = await dbAsync.get(
      "SELECT * FROM dm_conversations WHERE user1_id = ? AND user2_id = ?",
      [smallerId, largerId]
    );

    if (!conversation) {
      // Create new conversation
      const result = await dbAsync.run(
        "INSERT INTO dm_conversations (user1_id, user2_id) VALUES (?, ?)",
        [smallerId, largerId]
      );

      conversation = await dbAsync.get(
        "SELECT * FROM dm_conversations WHERE id = ?",
        [result.id]
      );
    }

    return conversation;
  } catch (error) {
    console.error("Error getting/creating DM conversation:", error);
    throw error;
  }
}

async function getDMMessages(conversationId, limit = 50) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT dm.*, u.username, u.color
       FROM dm_messages dm
       JOIN users u ON dm.sender_id = u.id
       WHERE dm.conversation_id = ? AND dm.is_deleted = 0
       ORDER BY dm.created_at DESC
       LIMIT ?`,
      [conversationId, limit],
      async (err, rows) => {
        if (err) {
          console.error("Error getting DM messages:", err);
          return reject(err);
        }

        try {
          // Get reactions for each message
          const messages = [];
          for (const message of rows) {
            const reactions = await getDmMessageReactions(message.id);
            messages.push({
              id: message.id,
              content: message.content,
              created_at: message.created_at,
              edited_at: message.edited_at,
              read_at: message.read_at,
              is_read: message.read_at !== null,
              user: {
                id: message.sender_id,
                username: message.username,
                color: message.color,
              },
              reactions: reactions,
            });
          }

          resolve(messages.reverse()); // Reverse to get chronological order
        } catch (error) {
          console.error("Error processing DM messages:", error);
          reject(error);
        }
      }
    );
  });
}

async function getDmMessageReactions(messageId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT dmr.emoji, dmr.user_id
       FROM dm_message_reactions dmr
       WHERE dmr.message_id = ?`,
      [messageId],
      (err, rows) => {
        if (err) {
          console.error("Error getting DM message reactions:", err);
          return reject(err);
        }

        // Group reactions by emoji
        const reactions = {};
        rows.forEach((row) => {
          if (!reactions[row.emoji]) {
            reactions[row.emoji] = [];
          }
          reactions[row.emoji].push(row.user_id);
        });

        resolve(reactions);
      }
    );
  });
}

async function getUserDMConversations(userId) {
  try {
    const conversations = await dbAsync.all(
      `
            SELECT 
                dm.id,
                dm.user1_id,
                dm.user2_id,
                dm.last_message_at,
                u1.username as user1_username,
                u1.color as user1_color,
                u2.username as user2_username,
                u2.color as user2_color,
                latest.content as last_message,
                latest.created_at as last_message_time
            FROM dm_conversations dm
            JOIN users u1 ON dm.user1_id = u1.id
            JOIN users u2 ON dm.user2_id = u2.id
            LEFT JOIN (
                SELECT DISTINCT conversation_id,
                       FIRST_VALUE(content) OVER (PARTITION BY conversation_id ORDER BY created_at DESC) as content,
                       FIRST_VALUE(created_at) OVER (PARTITION BY conversation_id ORDER BY created_at DESC) as created_at
                FROM dm_messages 
                WHERE is_deleted = 0
            ) latest ON dm.id = latest.conversation_id
            WHERE dm.user1_id = ? OR dm.user2_id = ?
            ORDER BY COALESCE(latest.created_at, dm.created_at) DESC
        `,
      [userId, userId]
    );

    return conversations.map((conv) => {
      const isUser1 = conv.user1_id === userId;
      const targetUser = isUser1
        ? {
            id: conv.user2_id,
            username: conv.user2_username,
            color: conv.user2_color,
          }
        : {
            id: conv.user1_id,
            username: conv.user1_username,
            color: conv.user1_color,
          };

      return {
        id: conv.id,
        targetUser,
        lastMessage: conv.last_message,
        lastMessageTime: conv.last_message_time,
        updatedAt: conv.last_message_at,
      };
    });
  } catch (error) {
    console.error("Error getting user DM conversations:", error);
    return [];
  }
}

async function handleDirectMessage(
  senderSession,
  targetUserId,
  content,
  socket,
  io
) {
  try {
    // Get or create conversation
    const conversation = await getOrCreateDMConversation(
      senderSession.id,
      targetUserId
    );

    // Save message
    const result = await dbAsync.run(
      "INSERT INTO dm_messages (conversation_id, sender_id, content) VALUES (?, ?, ?)",
      [conversation.id, senderSession.id, content]
    );

    // Update conversation last message time
    await dbAsync.run(
      "UPDATE dm_conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?",
      [conversation.id]
    );

    // Create message object with the correct format
    const message = {
      id: result.id,
      content: content,
      created_at: new Date().toISOString(),
      read_at: null,
      is_read: false,
      user: {
        id: senderSession.id,
        username: senderSession.username,
        color: senderSession.color,
      },
      reactions: {},
    };

    // Send to both users in the DM
    io.to(`dm_${conversation.id}`).emit("newDMMessage", {
      message,
      conversationId: conversation.id,
    });

    // Get target user info to notify about new DM
    const targetUser = await dbAsync.get("SELECT * FROM users WHERE id = ?", [
      targetUserId,
    ]);
    const targetSocketId = Array.from(activeUsers.entries()).find(
      ([socketId, user]) => user.id === targetUserId
    )?.[0];

    // Check if target user is actively viewing this conversation
    const targetSession = targetSocketId
      ? activeUsers.get(targetSocketId)
      : null;
    const isTargetViewingConversation =
      targetSession &&
      targetSession.currentDMConversationId === conversation.id;

    // If target is viewing the conversation, mark as read immediately
    if (isTargetViewingConversation) {
      await markDmMessagesAsRead(conversation.id, targetUserId);

      // Notify sender that message was read
      socket.emit("dmMessagesRead", {
        conversationId: conversation.id,
        readerId: targetUserId,
        readAt: new Date().toISOString(),
      });
    }

    if (targetSocketId && targetUser) {
      // Notify target user about new DM conversation if they're online
      io.to(targetSocketId).emit("newDMNotification", {
        conversation: {
          id: conversation.id,
          targetUser: {
            id: senderSession.id,
            username: senderSession.username,
            color: senderSession.color,
          },
        },
        message,
      });
    }
  } catch (error) {
    console.error("Error handling direct message:", error);
    throw error;
  }
}

// Mark DM messages as read
async function markDmMessagesAsRead(conversationId, readerId) {
  return new Promise((resolve, reject) => {
    // Update all unread messages sent by the other user
    db.run(
      `UPDATE dm_messages 
       SET read_at = CURRENT_TIMESTAMP 
       WHERE conversation_id = ? 
       AND sender_id != ? 
       AND read_at IS NULL`,
      [conversationId, readerId],
      function (err) {
        if (err) {
          console.error("Error marking messages as read:", err);
          reject(err);
        } else {
          resolve({ updated: this.changes });
        }
      }
    );
  });
}

// API endpoints
app.get("/api/channels", async (req, res) => {
  if (!dbInitialized) {
    return res.status(503).json({ error: "Database not ready" });
  }

  try {
    const channels = await dbAsync.all("SELECT * FROM channels ORDER BY name");
    res.json(channels);
  } catch (error) {
    console.error("Error getting channels:", error);
    res.status(500).json({ error: "Failed to get channels" });
  }
});

app.get("/api/users", async (req, res) => {
  if (!dbInitialized) {
    return res.status(503).json({ error: "Database not ready" });
  }

  try {
    const users = await dbAsync.all(`
            SELECT u.id, u.username, u.color, u.is_online, u.last_seen,
                   us.current_channel_id, us.in_voice_chat
            FROM users u
            LEFT JOIN user_sessions us ON u.id = us.user_id
            WHERE u.is_online = 1
            ORDER BY u.username
        `);
    res.json(users);
  } catch (error) {
    console.error("Error getting users:", error);
    res.status(500).json({ error: "Failed to get users" });
  }
});

app.get("/api/messages/:channelName", async (req, res) => {
  if (!dbInitialized) {
    return res.status(503).json({ error: "Database not ready" });
  }

  try {
    const { channelName } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const channel = await dbAsync.get("SELECT * FROM channels WHERE name = ?", [
      channelName,
    ]);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }

    const messages = await getChannelMessages(channel.id, limit);
    res.json(messages);
  } catch (error) {
    console.error("Error getting channel messages:", error);
    res.status(500).json({ error: "Failed to get messages" });
  }
});

app.get("/api/all-users", async (req, res) => {
  if (!dbInitialized) {
    return res.status(503).json({ error: "Database not ready" });
  }

  try {
    const users = await dbAsync.all(`
            SELECT id, username, color, is_online
            FROM users 
            WHERE username != 'ChatBot'
            ORDER BY is_online DESC, username
        `);
    res.json(users);
  } catch (error) {
    console.error("Error getting all users:", error);
    res.status(500).json({ error: "Failed to get users" });
  }
});

// Serve the frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`ChatCord server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to start chatting!`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down gracefully...");
  db.close((err) => {
    if (err) {
      console.error("Error closing database:", err.message);
    } else {
      console.log("Database connection closed.");
    }
    process.exit(0);
  });
});

module.exports = { app, server, io, db };
