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
async function initializeSchema() {
  try {
    console.log("Initializing database schema...");

    // Users table
    await db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        email TEXT UNIQUE,
        avatar TEXT,
        color TEXT DEFAULT '#7289DA',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP,
        socket_id TEXT,
        status TEXT DEFAULT 'offline',
        theme TEXT DEFAULT 'dark'
      )
    `);

    // Channels table
    await db.run(`
      CREATE TABLE IF NOT EXISTS channels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT DEFAULT 'text',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        FOREIGN KEY (created_by) REFERENCES users (id)
      )
    `);

    // Messages table
    await db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_edited BOOLEAN DEFAULT 0,
        is_deleted BOOLEAN DEFAULT 0,
        reactions TEXT DEFAULT '{}',
        FOREIGN KEY (channel_id) REFERENCES channels (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    // Direct Message Conversations table
    await db.run(`
      CREATE TABLE IF NOT EXISTS dm_conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        participants TEXT NOT NULL, -- JSON array of user IDs
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        active_call TEXT DEFAULT NULL, -- JSON object with call details
        call_history TEXT DEFAULT '[]' -- JSON array of call history
      )
    `);

    // Direct Messages table
    await db.run(`
      CREATE TABLE IF NOT EXISTS dm_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        sender_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_edited BOOLEAN DEFAULT 0,
        is_deleted BOOLEAN DEFAULT 0,
        read BOOLEAN DEFAULT 0,
        reactions TEXT DEFAULT '{}',
        FOREIGN KEY (conversation_id) REFERENCES dm_conversations (id),
        FOREIGN KEY (sender_id) REFERENCES users (id)
      )
    `);

    // Voice Channels table
    await db.run(`
      CREATE TABLE IF NOT EXISTS voice_channels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        FOREIGN KEY (created_by) REFERENCES users (id)
      )
    `);

    // Voice Channel Participants table
    await db.run(`
      CREATE TABLE IF NOT EXISTS voice_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_muted BOOLEAN DEFAULT 0,
        is_deafened BOOLEAN DEFAULT 0,
        FOREIGN KEY (channel_id) REFERENCES voice_channels (id),
        FOREIGN KEY (user_id) REFERENCES users (id),
        UNIQUE (channel_id, user_id)
      )
    `);

    console.log("Database schema initialized successfully");
  } catch (error) {
    console.error("Error initializing database schema:", error);
    throw error;
  }
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
  initializeSchema,
  getUserColor,
};
