const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const { initializeDatabase } = require("./models/schema");
const apiRoutes = require("./routes/api");
const initializeSocket = require("./socket");

const app = express();
const server = http.createServer(app);

// Initialize socket.io
const io = initializeSocket(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// API routes
app.use("/api", apiRoutes);

// Serve the frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public", "index.html"));
});

// Initialize database and start server
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();

    // Start server
    server.listen(PORT, () => {
      console.log(`ChatCord server running on port ${PORT}`);
      console.log(`Visit http://localhost:${PORT} to start chatting!`);
    });
  } catch (error) {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down gracefully...");
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
});

module.exports = { app, server, io };
