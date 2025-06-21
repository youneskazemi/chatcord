const express = require("express");
const router = express.Router();
const { dbAsync, isInitialized } = require("../config/database");
const { getChannelMessages } = require("../models/messages");
const { getAllUsers } = require("../models/users");

// Get all channels
router.get("/channels", async (req, res) => {
  if (!isInitialized()) {
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

// Get online users
router.get("/users", async (req, res) => {
  if (!isInitialized()) {
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

// Get channel messages
router.get("/messages/:channelName", async (req, res) => {
  if (!isInitialized()) {
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

// Get all users
router.get("/all-users", async (req, res) => {
  if (!isInitialized()) {
    return res.status(503).json({ error: "Database not ready" });
  }

  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (error) {
    console.error("Error getting all users:", error);
    res.status(500).json({ error: "Failed to get users" });
  }
});

module.exports = router;
