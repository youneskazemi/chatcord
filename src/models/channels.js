const { db, dbAsync } = require("../config/database");

// Get channel users
async function getChannelUsers(channelId) {
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

// Update all channel user lists
async function updateAllChannelUserLists(io) {
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

module.exports = {
  getChannelUsers,
  updateAllChannelUserLists,
};
