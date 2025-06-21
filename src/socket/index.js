const socketIo = require("socket.io");
const { registerSocketHandlers } = require("./handlers");
const { isInitialized } = require("../config/database");

function initializeSocket(server) {
  const io = socketIo(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`New client connected: ${socket.id}`);

    // Check if database is initialized
    if (!isInitialized()) {
      socket.emit("joinError", {
        message: "Server is still initializing. Please try again in a moment.",
      });
      return;
    }

    // Register all socket event handlers
    registerSocketHandlers(io, socket);
  });

  return io;
}

module.exports = initializeSocket;
