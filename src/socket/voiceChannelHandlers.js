/**
 * Voice Channel Socket Handlers
 * Handles socket events for voice channels
 */

/**
 * Initialize voice channel socket handlers
 * @param {Object} io - Socket.IO instance
 * @param {Object} socket - Socket instance for the current connection
 * @param {Object} user - Current user data
 */
function initVoiceChannelHandlers(io, socket, user) {
  // Join a voice channel
  socket.on("joinVoiceChannel", async (data) => {
    try {
      const { channelId } = data;

      // Join the socket room for this voice channel
      socket.join(`voice:${channelId}`);

      // Add user to voice participants in database (implementation depends on your models)
      // await addVoiceParticipant(channelId, user.id);

      // Get current participants in the voice channel
      const participants = await getVoiceChannelParticipants(channelId);

      // Send current participants to the joining user
      socket.emit("voiceChannelParticipants", {
        channelId,
        participants,
      });

      // Notify all users in the channel about the new participant
      io.to(`voice:${channelId}`).emit("userJoinedVoiceChannel", {
        channelId,
        user: {
          id: user.id,
          username: user.username,
          avatar: user.avatar,
        },
      });

      console.log(`User ${user.username} joined voice channel ${channelId}`);
    } catch (error) {
      console.error("Error joining voice channel:", error);
      socket.emit("error", { message: "Failed to join voice channel" });
    }
  });

  // Leave a voice channel
  socket.on("leaveVoiceChannel", async (data) => {
    try {
      const { channelId } = data;

      // Leave the socket room for this voice channel
      socket.leave(`voice:${channelId}`);

      // Remove user from voice participants in database (implementation depends on your models)
      // await removeVoiceParticipant(channelId, user.id);

      // Notify all users in the channel about the participant leaving
      io.to(`voice:${channelId}`).emit("userLeftVoiceChannel", {
        channelId,
        userId: user.id,
      });

      console.log(`User ${user.username} left voice channel ${channelId}`);
    } catch (error) {
      console.error("Error leaving voice channel:", error);
      socket.emit("error", { message: "Failed to leave voice channel" });
    }
  });

  // Toggle mute status
  socket.on("toggleMute", async (data) => {
    try {
      const { channelId, isMuted } = data;

      // Update mute status in database (implementation depends on your models)
      // await updateVoiceParticipantMuteStatus(channelId, user.id, isMuted);

      // Notify all users in the channel about the mute status change
      io.to(`voice:${channelId}`).emit("userMuteStatusChanged", {
        channelId,
        userId: user.id,
        isMuted,
      });

      console.log(
        `User ${user.username} ${
          isMuted ? "muted" : "unmuted"
        } in voice channel ${channelId}`
      );
    } catch (error) {
      console.error("Error toggling mute status:", error);
      socket.emit("error", { message: "Failed to toggle mute status" });
    }
  });

  // Toggle deafen status
  socket.on("toggleDeafen", async (data) => {
    try {
      const { channelId, isDeafened } = data;

      // Update deafen status in database (implementation depends on your models)
      // await updateVoiceParticipantDeafenStatus(channelId, user.id, isDeafened);

      // Notify all users in the channel about the deafen status change
      io.to(`voice:${channelId}`).emit("userDeafenStatusChanged", {
        channelId,
        userId: user.id,
        isDeafened,
      });

      console.log(
        `User ${user.username} ${
          isDeafened ? "deafened" : "undeafened"
        } in voice channel ${channelId}`
      );
    } catch (error) {
      console.error("Error toggling deafen status:", error);
      socket.emit("error", { message: "Failed to toggle deafen status" });
    }
  });

  // WebRTC signaling for voice channels

  // Send offer to a user in the voice channel
  socket.on("voiceOffer", (data) => {
    const { targetUserId, sdp, channelId } = data;

    // Forward the offer to the target user
    io.to(`user:${targetUserId}`).emit("voiceOffer", {
      from: user.id,
      sdp,
      channelId,
    });

    console.log(
      `User ${user.username} sent voice offer to user ${targetUserId}`
    );
  });

  // Send answer to a user in the voice channel
  socket.on("voiceAnswer", (data) => {
    const { targetUserId, sdp, channelId } = data;

    // Forward the answer to the target user
    io.to(`user:${targetUserId}`).emit("voiceAnswer", {
      from: user.id,
      sdp,
      channelId,
    });

    console.log(
      `User ${user.username} sent voice answer to user ${targetUserId}`
    );
  });

  // Send ICE candidate to a user in the voice channel
  socket.on("voiceIceCandidate", (data) => {
    const { targetUserId, candidate, channelId } = data;

    // Forward the ICE candidate to the target user
    io.to(`user:${targetUserId}`).emit("voiceIceCandidate", {
      from: user.id,
      candidate,
      channelId,
    });

    console.log(
      `User ${user.username} sent ICE candidate to user ${targetUserId}`
    );
  });
}

/**
 * Get participants in a voice channel
 * @param {string} channelId - Voice channel ID
 * @returns {Promise<Array>} - Array of participant objects
 */
async function getVoiceChannelParticipants(channelId) {
  // This is a placeholder implementation
  // In a real application, you would fetch this from the database
  return [];
}

module.exports = { initVoiceChannelHandlers };
