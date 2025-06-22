/**
 * Socket.IO Initialization and Connection Handling
 */

const socketIO = require("socket.io");
const { initDmVoiceHandlers } = require("./dmVoiceHandlers");
const { initChannelHandlers } = require("./channelHandlers");
const { initDirectMessageHandlers } = require("./directMessageHandlers");
const { initVoiceChannelHandlers } = require("./voiceChannelHandlers");
const { getUserById } = require("../models/users");

/**
 * Initialize Socket.IO with the HTTP server
 * @param {Object} server - HTTP server instance
 * @returns {Object} - Socket.IO instance
 */
function initializeSocket(server) {
  const io = socketIO(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Middleware to authenticate socket connections
  io.use(async (socket, next) => {
    try {
      const userId = socket.handshake.auth.userId;

      if (!userId) {
        return next(new Error("Authentication failed: No user ID provided"));
      }

      // Get user from database
      const user = await getUserById(userId);

      if (!user) {
        return next(new Error("Authentication failed: User not found"));
      }

      // Attach user data to socket
      socket.user = user;
      next();
    } catch (error) {
      console.error("Socket authentication error:", error);
      next(new Error("Authentication failed: Internal server error"));
    }
  });

  // Handle new connections
  io.on("connection", async (socket) => {
    try {
      const user = socket.user;

      console.log(`User connected: ${user.username} (${user.id})`);

      // Update user's socket ID in database
      await updateUserSocketId(user.id, socket.id);

      // Join user to their own room for private messages
      socket.join(`user:${user.id}`);

      // Initialize handlers
      initChannelHandlers(io, socket, user);
      initDirectMessageHandlers(io, socket, user);
      initVoiceChannelHandlers(io, socket, user);
      initDmVoiceHandlers(io, socket, user);

      // Handle disconnection
      socket.on("disconnect", async () => {
        console.log(`User disconnected: ${user.username} (${user.id})`);

        // Clear user's socket ID in database
        await updateUserSocketId(user.id, null);

        // Emit user offline status to others
        io.emit("userStatusChanged", {
          userId: user.id,
          status: "offline",
        });
      });

      // Emit user online status to others
      io.emit("userStatusChanged", {
        userId: user.id,
        status: "online",
      });
    } catch (error) {
      console.error("Error handling socket connection:", error);
    }
  });

  return io;
}

/**
 * Update user's socket ID in the database
 * @param {string} userId - User ID
 * @param {string|null} socketId - Socket ID or null if disconnected
 */
async function updateUserSocketId(userId, socketId) {
  try {
    const db = require("../config/database");
    await db.run(
      "UPDATE users SET socket_id = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?",
      [socketId, userId]
    );
  } catch (error) {
    console.error("Error updating user socket ID:", error);
  }
}

module.exports = { initializeSocket };
