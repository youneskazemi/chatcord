const { db, dbAsync } = require("../config/database");

// Get or create DM conversation
async function getOrCreateDMConversation(user1Id, user2Id) {
  try {
    // Ensure consistent ordering (smaller ID first)
    const [smallerId, largerId] =
      user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];

    // Try to find existing conversation
    let conversation = await dbAsync.get(
      "SELECT * FROM dm_conversations WHERE user1_id = ? AND user2_id = ?",
      [smallerId, largerId]
    );

    if (!conversation) {
      // Create new conversation
      const result = await dbAsync.run(
        "INSERT INTO dm_conversations (user1_id, user2_id) VALUES (?, ?)",
        [smallerId, largerId]
      );

      conversation = await dbAsync.get(
        "SELECT * FROM dm_conversations WHERE id = ?",
        [result.id]
      );
    }

    return conversation;
  } catch (error) {
    console.error("Error getting/creating DM conversation:", error);
    throw error;
  }
}

// Get user DM conversations
async function getUserDMConversations(userId) {
  try {
    const conversations = await dbAsync.all(
      `
            SELECT 
                dm.id,
                dm.user1_id,
                dm.user2_id,
                dm.last_message_at,
                u1.username as user1_username,
                u1.color as user1_color,
                u2.username as user2_username,
                u2.color as user2_color,
                latest.content as last_message,
                latest.created_at as last_message_time
            FROM dm_conversations dm
            JOIN users u1 ON dm.user1_id = u1.id
            JOIN users u2 ON dm.user2_id = u2.id
            LEFT JOIN (
                SELECT DISTINCT conversation_id,
                       FIRST_VALUE(content) OVER (PARTITION BY conversation_id ORDER BY created_at DESC) as content,
                       FIRST_VALUE(created_at) OVER (PARTITION BY conversation_id ORDER BY created_at DESC) as created_at
                FROM dm_messages 
                WHERE is_deleted = 0
            ) latest ON dm.id = latest.conversation_id
            WHERE dm.user1_id = ? OR dm.user2_id = ?
            ORDER BY COALESCE(latest.created_at, dm.created_at) DESC
        `,
      [userId, userId]
    );

    return conversations.map((conv) => {
      const isUser1 = conv.user1_id === userId;
      const targetUser = isUser1
        ? {
            id: conv.user2_id,
            username: conv.user2_username,
            color: conv.user2_color,
          }
        : {
            id: conv.user1_id,
            username: conv.user1_username,
            color: conv.user1_color,
          };

      return {
        id: conv.id,
        targetUser,
        lastMessage: conv.last_message,
        lastMessageTime: conv.last_message_time,
        updatedAt: conv.last_message_at,
      };
    });
  } catch (error) {
    console.error("Error getting user DM conversations:", error);
    return [];
  }
}

// Handle direct message
async function handleDirectMessage(
  senderSession,
  targetUserId,
  content,
  socket,
  io
) {
  try {
    // Get or create conversation
    const conversation = await getOrCreateDMConversation(
      senderSession.id,
      targetUserId
    );

    // Save message
    const result = await dbAsync.run(
      "INSERT INTO dm_messages (conversation_id, sender_id, content) VALUES (?, ?, ?)",
      [conversation.id, senderSession.id, content]
    );

    // Update conversation last message time
    await dbAsync.run(
      "UPDATE dm_conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?",
      [conversation.id]
    );

    // Create message object with the correct format
    const message = {
      id: result.id,
      content: content,
      created_at: new Date().toISOString(),
      read_at: null,
      is_read: false,
      user: {
        id: senderSession.id,
        username: senderSession.username,
        color: senderSession.color,
      },
      reactions: {},
    };

    return { conversation, message };
  } catch (error) {
    console.error("Error handling direct message:", error);
    throw error;
  }
}

module.exports = {
  getOrCreateDMConversation,
  getUserDMConversations,
  handleDirectMessage,
};
