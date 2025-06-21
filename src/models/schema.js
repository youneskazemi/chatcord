const { db, setInitialized } = require("../config/database");
const bcrypt = require("bcryptjs");

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
          setInitialized();
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

module.exports = {
  initializeDatabase,
  getUserColor,
};
