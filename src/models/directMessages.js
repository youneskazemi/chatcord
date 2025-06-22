/**
 * Direct Messages Model
 * Handles database operations for direct message conversations
 */

const db = require("../config/database");

/**
 * Get a DM conversation by ID
 * @param {string} id - Conversation ID
 * @returns {Promise<Object|null>} - Conversation object or null if not found
 */
async function getDmConversationById(id) {
  try {
    const conversation = await db.get(
      "SELECT * FROM dm_conversations WHERE id = ?",
      [id]
    );

    if (!conversation) {
      return null;
    }

    // Parse JSON fields
    conversation.participants = JSON.parse(conversation.participants || "[]");
    conversation.activeCall = JSON.parse(conversation.active_call || "null");
    conversation.callHistory = JSON.parse(conversation.call_history || "[]");

    return conversation;
  } catch (error) {
    console.error("Error getting DM conversation by ID:", error);
    throw error;
  }
}

/**
 * Get DM conversations for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of conversation objects
 */
async function getDmConversationsForUser(userId) {
  try {
    const conversations = await db.all(
      `SELECT dc.*, 
       (SELECT COUNT(*) FROM dm_messages 
        WHERE conversation_id = dc.id AND read = 0 AND sender_id != ?) as unread_count
       FROM dm_conversations dc
       WHERE dc.participants LIKE ?
       ORDER BY dc.updated_at DESC`,
      [userId, `%${userId}%`]
    );

    return conversations.map((conversation) => {
      // Parse JSON fields
      conversation.participants = JSON.parse(conversation.participants || "[]");
      conversation.activeCall = JSON.parse(conversation.active_call || "null");
      conversation.callHistory = JSON.parse(conversation.call_history || "[]");

      return conversation;
    });
  } catch (error) {
    console.error("Error getting DM conversations for user:", error);
    throw error;
  }
}

/**
 * Create a new DM conversation
 * @param {Array} participants - Array of user IDs
 * @returns {Promise<Object>} - New conversation object
 */
async function createDmConversation(participants) {
  try {
    const now = new Date().toISOString();

    const result = await db.run(
      `INSERT INTO dm_conversations (participants, created_at, updated_at) 
       VALUES (?, ?, ?)`,
      [JSON.stringify(participants), now, now]
    );

    return {
      id: result.lastID,
      participants,
      created_at: now,
      updated_at: now,
      activeCall: null,
      callHistory: [],
    };
  } catch (error) {
    console.error("Error creating DM conversation:", error);
    throw error;
  }
}

/**
 * Update a DM conversation
 * @param {string} id - Conversation ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<boolean>} - Success status
 */
async function updateDmConversation(id, updates) {
  try {
    const conversation = await getDmConversationById(id);
    if (!conversation) {
      return false;
    }

    const now = new Date().toISOString();
    let updateFields = [];
    let params = [];

    // Handle activeCall updates
    if (updates.activeCall !== undefined) {
      updateFields.push("active_call = ?");
      params.push(JSON.stringify(updates.activeCall));
    }

    // Handle callHistory updates
    if (updates.callHistory !== undefined) {
      updateFields.push("call_history = ?");
      params.push(JSON.stringify(updates.callHistory));
    }

    // Always update the updated_at timestamp
    updateFields.push("updated_at = ?");
    params.push(now);

    // Add the conversation ID to params
    params.push(id);

    await db.run(
      `UPDATE dm_conversations SET ${updateFields.join(", ")} WHERE id = ?`,
      params
    );

    return true;
  } catch (error) {
    console.error("Error updating DM conversation:", error);
    throw error;
  }
}

/**
 * Get DM messages for a conversation
 * @param {string} conversationId - Conversation ID
 * @param {number} limit - Maximum number of messages to return
 * @param {number} offset - Number of messages to skip
 * @returns {Promise<Array>} - Array of message objects
 */
async function getDmMessages(conversationId, limit = 50, offset = 0) {
  try {
    const messages = await db.all(
      `SELECT * FROM dm_messages 
       WHERE conversation_id = ? 
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [conversationId, limit, offset]
    );

    return messages.map((message) => {
      // Parse JSON fields
      message.reactions = JSON.parse(message.reactions || "{}");

      return message;
    });
  } catch (error) {
    console.error("Error getting DM messages:", error);
    throw error;
  }
}

/**
 * Add a message to a DM conversation
 * @param {Object} message - Message data
 * @returns {Promise<Object>} - New message object
 */
async function addDmMessage(message) {
  try {
    const now = new Date().toISOString();

    const result = await db.run(
      `INSERT INTO dm_messages (conversation_id, sender_id, content, created_at, updated_at, read) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [message.conversationId, message.senderId, message.content, now, now, 0]
    );

    // Update conversation's updated_at timestamp
    await db.run("UPDATE dm_conversations SET updated_at = ? WHERE id = ?", [
      now,
      message.conversationId,
    ]);

    return {
      id: result.lastID,
      conversation_id: message.conversationId,
      sender_id: message.senderId,
      content: message.content,
      created_at: now,
      updated_at: now,
      read: 0,
      reactions: {},
    };
  } catch (error) {
    console.error("Error adding DM message:", error);
    throw error;
  }
}

/**
 * Mark messages as read
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID (messages not sent by this user will be marked as read)
 * @returns {Promise<boolean>} - Success status
 */
async function markDmMessagesAsRead(conversationId, userId) {
  try {
    await db.run(
      `UPDATE dm_messages 
       SET read = 1 
       WHERE conversation_id = ? AND sender_id != ? AND read = 0`,
      [conversationId, userId]
    );

    return true;
  } catch (error) {
    console.error("Error marking DM messages as read:", error);
    throw error;
  }
}

module.exports = {
  getDmConversationById,
  getDmConversationsForUser,
  createDmConversation,
  updateDmConversation,
  getDmMessages,
  addDmMessage,
  markDmMessagesAsRead,
};
