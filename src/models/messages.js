const { db, dbAsync } = require("../config/database");

// Get channel messages
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

// Get message reactions
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

// Get DM messages
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

// Get DM message reactions
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

module.exports = {
  getChannelMessages,
  getMessageReactions,
  getDMMessages,
  getDmMessageReactions,
  markDmMessagesAsRead,
};
