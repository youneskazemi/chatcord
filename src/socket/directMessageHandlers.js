/**
 * Direct Message Socket Handlers
 * Handles socket events for direct messages between users
 */

const {
  getDmConversationsForUser,
  createDmConversation,
  getDmMessages,
  addDmMessage,
  markDmMessagesAsRead,
} = require("../models/directMessages");
const { getUserById } = require("../models/users");

/**
 * Initialize direct message socket handlers
 * @param {Object} io - Socket.IO instance
 * @param {Object} socket - Socket instance for the current connection
 * @param {Object} user - Current user data
 */
function initDirectMessageHandlers(io, socket, user) {
  // Get DM conversations for the current user
  socket.on("getDmConversations", async () => {
    try {
      const conversations = await getDmConversationsForUser(user.id);

      // Emit the conversations to the user
      socket.emit("dmConversationsList", { conversations });

      console.log(
        `Sent ${conversations.length} DM conversations to user ${user.username}`
      );
    } catch (error) {
      console.error("Error getting DM conversations:", error);
      socket.emit("error", { message: "Failed to get DM conversations" });
    }
  });

  // Create a new DM conversation
  socket.on("createDmConversation", async (data) => {
    try {
      const { targetUserId } = data;

      // Check if target user exists
      const targetUser = await getUserById(targetUserId);
      if (!targetUser) {
        return socket.emit("error", { message: "Target user not found" });
      }

      // Create new conversation
      const conversation = await createDmConversation([user.id, targetUserId]);

      // Emit the new conversation to both users
      socket.emit("dmConversationCreated", {
        conversation,
        messages: [],
      });

      if (targetUser.socketId) {
        io.to(targetUser.socketId).emit("newDMNotification", {
          conversation,
          sender: {
            id: user.id,
            username: user.username,
            avatar: user.avatar,
          },
        });
      }

      console.log(
        `User ${user.username} created DM conversation with ${targetUser.username}`
      );
    } catch (error) {
      console.error("Error creating DM conversation:", error);
      socket.emit("error", { message: "Failed to create DM conversation" });
    }
  });

  // Open a DM conversation
  socket.on("openDmConversation", async (data) => {
    try {
      const { conversationId } = data;

      // Get messages for the conversation
      const messages = await getDmMessages(conversationId);

      // Mark messages as read
      await markDmMessagesAsRead(conversationId, user.id);

      // Emit the conversation and messages to the user
      socket.emit("dmSwitched", {
        conversationId,
        messages,
      });

      console.log(
        `User ${user.username} opened DM conversation ${conversationId}`
      );
    } catch (error) {
      console.error("Error opening DM conversation:", error);
      socket.emit("error", { message: "Failed to open DM conversation" });
    }
  });

  // Send a DM
  socket.on("sendDm", async (data) => {
    try {
      const { conversationId, content } = data;

      // Add message to database
      const message = await addDmMessage({
        conversationId,
        senderId: user.id,
        content,
      });

      // Get the conversation to find the recipient
      const conversation = await getDmConversationById(conversationId);
      if (!conversation) {
        return socket.emit("error", { message: "Conversation not found" });
      }

      // Find the recipient (the other user in the conversation)
      const recipientId = conversation.participants.find(
        (id) => id !== user.id
      );
      const recipient = await getUserById(recipientId);

      // Send the message to the sender
      socket.emit("newDMMessage", {
        message: {
          ...message,
          sender: {
            id: user.id,
            username: user.username,
            avatar: user.avatar,
          },
        },
      });

      // Send the message to the recipient if they're online
      if (recipient && recipient.socketId) {
        io.to(recipient.socketId).emit("newDMMessage", {
          message: {
            ...message,
            sender: {
              id: user.id,
              username: user.username,
              avatar: user.avatar,
            },
          },
        });

        // Also send a notification if they don't have the conversation open
        io.to(recipient.socketId).emit("newDMNotification", {
          conversationId,
          message,
          sender: {
            id: user.id,
            username: user.username,
            avatar: user.avatar,
          },
        });
      }

      console.log(
        `User ${user.username} sent DM to conversation ${conversationId}`
      );
    } catch (error) {
      console.error("Error sending DM:", error);
      socket.emit("error", { message: "Failed to send DM" });
    }
  });

  // React to a DM
  socket.on("reactToDm", async (data) => {
    try {
      const { messageId, reaction } = data;

      // Update message reaction in database (implementation depends on your models)
      // const updatedMessage = await addDmReaction(messageId, user.id, reaction);

      // For now, we'll just create a reaction update object
      const reactionUpdate = {
        messageId,
        userId: user.id,
        username: user.username,
        reaction,
      };

      // Broadcast the reaction update to all users
      io.emit("dmMessageReactionUpdated", reactionUpdate);

      console.log(
        `User ${user.username} reacted to DM ${messageId} with ${reaction}`
      );
    } catch (error) {
      console.error("Error reacting to DM:", error);
      socket.emit("error", { message: "Failed to add reaction" });
    }
  });

  // Edit a DM
  socket.on("editDm", async (data) => {
    try {
      const { messageId, content } = data;

      // Update message in database (implementation depends on your models)
      // const updatedMessage = await editDmMessage(messageId, user.id, content);

      // For now, we'll just create a message update object
      const messageUpdate = {
        id: messageId,
        userId: user.id,
        content,
        editedAt: new Date().toISOString(),
      };

      // Broadcast the message update to all users
      io.emit("dmMessageEdited", messageUpdate);

      console.log(`User ${user.username} edited DM ${messageId}`);
    } catch (error) {
      console.error("Error editing DM:", error);
      socket.emit("error", { message: "Failed to edit DM" });
    }
  });

  // Mark DMs as read
  socket.on("markDmsAsRead", async (data) => {
    try {
      const { conversationId } = data;

      // Mark messages as read in database
      await markDmMessagesAsRead(conversationId, user.id);

      // Emit the read status to all users in the conversation
      io.emit("dmMessagesRead", {
        conversationId,
        userId: user.id,
      });

      console.log(
        `User ${user.username} marked messages as read in conversation ${conversationId}`
      );
    } catch (error) {
      console.error("Error marking DMs as read:", error);
      socket.emit("error", { message: "Failed to mark DMs as read" });
    }
  });
}

module.exports = { initDirectMessageHandlers };
