/**
 * Channel Socket Handlers
 * Handles socket events for text channels
 */

/**
 * Initialize channel socket handlers
 * @param {Object} io - Socket.IO instance
 * @param {Object} socket - Socket instance for the current connection
 * @param {Object} user - Current user data
 */
function initChannelHandlers(io, socket, user) {
  // Join a channel
  socket.on("joinChannel", async (data) => {
    try {
      const { channelId } = data;

      // Join the socket room for this channel
      socket.join(`channel:${channelId}`);

      console.log(`User ${user.username} joined channel ${channelId}`);

      // Notify other users in the channel
      socket.to(`channel:${channelId}`).emit("userJoinedChannel", {
        userId: user.id,
        username: user.username,
        channelId,
      });
    } catch (error) {
      console.error("Error joining channel:", error);
      socket.emit("error", { message: "Failed to join channel" });
    }
  });

  // Leave a channel
  socket.on("leaveChannel", async (data) => {
    try {
      const { channelId } = data;

      // Leave the socket room for this channel
      socket.leave(`channel:${channelId}`);

      console.log(`User ${user.username} left channel ${channelId}`);

      // Notify other users in the channel
      socket.to(`channel:${channelId}`).emit("userLeftChannel", {
        userId: user.id,
        username: user.username,
        channelId,
      });
    } catch (error) {
      console.error("Error leaving channel:", error);
      socket.emit("error", { message: "Failed to leave channel" });
    }
  });

  // Send a message to a channel
  socket.on("sendChannelMessage", async (data) => {
    try {
      const { channelId, content } = data;

      // Add message to database (implementation depends on your models)
      // const message = await addChannelMessage({ channelId, userId: user.id, content });

      // For now, we'll just create a message object
      const message = {
        id: Date.now().toString(),
        channelId,
        userId: user.id,
        username: user.username,
        content,
        createdAt: new Date().toISOString(),
        reactions: {},
      };

      // Broadcast the message to all users in the channel
      io.to(`channel:${channelId}`).emit("newChannelMessage", message);

      console.log(`User ${user.username} sent message to channel ${channelId}`);
    } catch (error) {
      console.error("Error sending channel message:", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  // React to a message
  socket.on("reactToMessage", async (data) => {
    try {
      const { messageId, reaction } = data;

      // Update message reaction in database (implementation depends on your models)
      // const updatedMessage = await addMessageReaction(messageId, user.id, reaction);

      // For now, we'll just create a reaction update object
      const reactionUpdate = {
        messageId,
        userId: user.id,
        username: user.username,
        reaction,
      };

      // Broadcast the reaction update to all users
      io.emit("messageReactionUpdated", reactionUpdate);

      console.log(
        `User ${user.username} reacted to message ${messageId} with ${reaction}`
      );
    } catch (error) {
      console.error("Error reacting to message:", error);
      socket.emit("error", { message: "Failed to add reaction" });
    }
  });

  // Edit a message
  socket.on("editMessage", async (data) => {
    try {
      const { messageId, content } = data;

      // Update message in database (implementation depends on your models)
      // const updatedMessage = await editMessage(messageId, user.id, content);

      // For now, we'll just create a message update object
      const messageUpdate = {
        id: messageId,
        userId: user.id,
        content,
        editedAt: new Date().toISOString(),
      };

      // Broadcast the message update to all users
      io.emit("messageEdited", messageUpdate);

      console.log(`User ${user.username} edited message ${messageId}`);
    } catch (error) {
      console.error("Error editing message:", error);
      socket.emit("error", { message: "Failed to edit message" });
    }
  });

  // Delete a message
  socket.on("deleteMessage", async (data) => {
    try {
      const { messageId } = data;

      // Delete message in database (implementation depends on your models)
      // await deleteMessage(messageId, user.id);

      // Broadcast the message deletion to all users
      io.emit("messageDeleted", { messageId });

      console.log(`User ${user.username} deleted message ${messageId}`);
    } catch (error) {
      console.error("Error deleting message:", error);
      socket.emit("error", { message: "Failed to delete message" });
    }
  });
}

module.exports = { initChannelHandlers };
