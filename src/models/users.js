const { db, dbAsync } = require("../config/database");
const bcrypt = require("bcryptjs");
const { getUserColor } = require("./schema");

// In-memory storage for active connections
const activeUsers = new Map(); // socket.id -> user session data

// Get user by username
async function getUserByUsername(username) {
  try {
    return await dbAsync.get("SELECT * FROM users WHERE username = ?", [
      username.trim(),
    ]);
  } catch (error) {
    console.error("Error getting user by username:", error);
    throw error;
  }
}

// Get user by ID
async function getUserById(userId) {
  try {
    return await dbAsync.get("SELECT * FROM users WHERE id = ?", [userId]);
  } catch (error) {
    console.error("Error getting user by ID:", error);
    throw error;
  }
}

// Create new user
async function createUser(username, password = null) {
  try {
    const color = getUserColor(username);
    const hashedPassword = password ? bcrypt.hashSync(password, 10) : null;

    const result = await dbAsync.run(
      "INSERT INTO users (username, color, password_hash) VALUES (?, ?, ?)",
      [username.trim(), color, hashedPassword]
    );

    return await getUserById(result.id);
  } catch (error) {
    console.error("Error creating user:", error);
    throw error;
  }
}

// Update user password
async function updateUserPassword(userId, password) {
  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    await dbAsync.run("UPDATE users SET password_hash = ? WHERE id = ?", [
      hashedPassword,
      userId,
    ]);
    return true;
  } catch (error) {
    console.error("Error updating user password:", error);
    throw error;
  }
}

// Update user online status
async function updateUserOnlineStatus(userId, isOnline) {
  try {
    await dbAsync.run(
      "UPDATE users SET is_online = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?",
      [isOnline ? 1 : 0, userId]
    );
    return true;
  } catch (error) {
    console.error("Error updating user online status:", error);
    throw error;
  }
}

// Create user session
async function createUserSession(userId, socketId, channelId) {
  try {
    await dbAsync.run(
      "INSERT INTO user_sessions (user_id, socket_id, current_channel_id) VALUES (?, ?, ?)",
      [userId, socketId, channelId]
    );
    return true;
  } catch (error) {
    console.error("Error creating user session:", error);
    throw error;
  }
}

// Remove user session
async function removeUserSession(socketId) {
  try {
    await dbAsync.run("DELETE FROM user_sessions WHERE socket_id = ?", [
      socketId,
    ]);
    return true;
  } catch (error) {
    console.error("Error removing user session:", error);
    throw error;
  }
}

// Update user session channel
async function updateUserSessionChannel(socketId, channelId) {
  try {
    await dbAsync.run(
      "UPDATE user_sessions SET current_channel_id = ? WHERE socket_id = ?",
      [channelId, socketId]
    );
    return true;
  } catch (error) {
    console.error("Error updating user session channel:", error);
    throw error;
  }
}

// Update user voice chat status
async function updateUserVoiceChatStatus(
  socketId,
  inVoiceChat,
  voiceChannelId = null
) {
  try {
    await dbAsync.run(
      "UPDATE user_sessions SET in_voice_chat = ?, voice_channel_id = ? WHERE socket_id = ?",
      [inVoiceChat ? 1 : 0, voiceChannelId, socketId]
    );
    return true;
  } catch (error) {
    console.error("Error updating user voice chat status:", error);
    throw error;
  }
}

// Get all users
async function getAllUsers(excludeUserId = null) {
  try {
    let query = `
      SELECT id, username, color, is_online
      FROM users 
      WHERE username != 'ChatBot'
    `;

    const params = [];

    if (excludeUserId) {
      query += " AND id != ?";
      params.push(excludeUserId);
    }

    query += " ORDER BY is_online DESC, username";

    return await dbAsync.all(query, params);
  } catch (error) {
    console.error("Error getting all users:", error);
    return [];
  }
}

module.exports = {
  activeUsers,
  getUserByUsername,
  getUserById,
  createUser,
  updateUserPassword,
  updateUserOnlineStatus,
  createUserSession,
  removeUserSession,
  updateUserSessionChannel,
  updateUserVoiceChatStatus,
  getAllUsers,
};
