/**
 * Direct Message Voice Chat Socket Handlers
 * Handles socket events for 1-to-1 voice calls in direct messages
 */

const { getUserById } = require("../models/users");
const {
  getDmConversationById,
  updateDmConversation,
} = require("../models/directMessages");

/**
 * Initialize DM voice chat socket handlers
 * @param {Object} io - Socket.IO instance
 * @param {Object} socket - Socket instance for the current connection
 * @param {Object} user - Current user data
 */
function initDmVoiceHandlers(io, socket, user) {
  /**
   * Handle initiating a direct call
   * @param {Object} data - Call data including recipient ID, conversation ID, and SDP offer
   */
  socket.on("initiateDirectCall", async (data) => {
    try {
      const { recipientId, conversationId, sdp } = data;

      // Validate the conversation exists and user is a participant
      const conversation = await getDmConversationById(conversationId);
      if (!conversation) {
        return socket.emit("error", { message: "Conversation not found" });
      }

      // Check if user is part of this conversation
      if (conversation.participants.indexOf(user.id) === -1) {
        return socket.emit("error", {
          message: "You are not part of this conversation",
        });
      }

      // Check if recipient is part of this conversation
      if (conversation.participants.indexOf(recipientId) === -1) {
        return socket.emit("error", {
          message: "Recipient is not part of this conversation",
        });
      }

      // Get recipient user data
      const recipient = await getUserById(recipientId);
      if (!recipient) {
        return socket.emit("error", { message: "Recipient user not found" });
      }

      // Update conversation with call status
      await updateDmConversation(conversationId, {
        activeCall: {
          status: "ringing",
          initiator: user.id,
          startTime: new Date().toISOString(),
        },
      });

      // Emit event to recipient
      io.to(recipient.socketId).emit("directCallOffer", {
        callerId: user.id,
        callerName: user.username,
        callerAvatar: user.avatar,
        conversationId,
        sdp,
      });

      console.log(
        `User ${user.username} initiated call to ${recipient.username}`
      );
    } catch (error) {
      console.error("Error initiating direct call:", error);
      socket.emit("error", { message: "Failed to initiate call" });
    }
  });

  /**
   * Handle accepting a direct call
   * @param {Object} data - Call data including caller ID, conversation ID, and SDP answer
   */
  socket.on("acceptDirectCall", async (data) => {
    try {
      const { callerId, conversationId, sdp } = data;

      // Validate the conversation exists
      const conversation = await getDmConversationById(conversationId);
      if (!conversation) {
        return socket.emit("error", { message: "Conversation not found" });
      }

      // Check if there's an active call
      if (
        !conversation.activeCall ||
        conversation.activeCall.status !== "ringing"
      ) {
        return socket.emit("error", { message: "No active call to accept" });
      }

      // Check if the call initiator matches
      if (conversation.activeCall.initiator !== callerId) {
        return socket.emit("error", { message: "Call initiator mismatch" });
      }

      // Get caller user data
      const caller = await getUserById(callerId);
      if (!caller) {
        return socket.emit("error", { message: "Caller user not found" });
      }

      // Update conversation with call status
      await updateDmConversation(conversationId, {
        activeCall: {
          status: "connected",
          initiator: callerId,
          startTime: conversation.activeCall.startTime,
          acceptTime: new Date().toISOString(),
        },
      });

      // Emit event to caller
      io.to(caller.socketId).emit("directCallAccepted", {
        recipientId: user.id,
        conversationId,
        sdp,
      });

      console.log(
        `User ${user.username} accepted call from ${caller.username}`
      );
    } catch (error) {
      console.error("Error accepting direct call:", error);
      socket.emit("error", { message: "Failed to accept call" });
    }
  });

  /**
   * Handle rejecting a direct call
   * @param {Object} data - Call data including caller ID and conversation ID
   */
  socket.on("rejectDirectCall", async (data) => {
    try {
      const { callerId, conversationId } = data;

      // Validate the conversation exists
      const conversation = await getDmConversationById(conversationId);
      if (!conversation) {
        return socket.emit("error", { message: "Conversation not found" });
      }

      // Check if there's an active call
      if (
        !conversation.activeCall ||
        conversation.activeCall.status !== "ringing"
      ) {
        return socket.emit("error", { message: "No active call to reject" });
      }

      // Get caller user data
      const caller = await getUserById(callerId);
      if (!caller) {
        return socket.emit("error", { message: "Caller user not found" });
      }

      // Update conversation to remove active call
      await updateDmConversation(conversationId, {
        activeCall: null,
      });

      // Emit event to caller
      io.to(caller.socketId).emit("directCallRejected", {
        recipientId: user.id,
        conversationId,
      });

      console.log(
        `User ${user.username} rejected call from ${caller.username}`
      );
    } catch (error) {
      console.error("Error rejecting direct call:", error);
      socket.emit("error", { message: "Failed to reject call" });
    }
  });

  /**
   * Handle ending a direct call
   * @param {Object} data - Call data including recipient ID and conversation ID
   */
  socket.on("endDirectCall", async (data) => {
    try {
      const { recipientId, conversationId } = data;

      // Validate the conversation exists
      const conversation = await getDmConversationById(conversationId);
      if (!conversation) {
        return socket.emit("error", { message: "Conversation not found" });
      }

      // Check if there's an active call
      if (!conversation.activeCall) {
        return socket.emit("error", { message: "No active call to end" });
      }

      // Get recipient user data
      const recipient = await getUserById(recipientId);
      if (!recipient) {
        return socket.emit("error", { message: "Recipient user not found" });
      }

      // Calculate call duration
      let callDuration = 0;
      if (conversation.activeCall.acceptTime) {
        const startTime = new Date(conversation.activeCall.acceptTime);
        const endTime = new Date();
        callDuration = Math.floor((endTime - startTime) / 1000); // Duration in seconds
      }

      // Update conversation call history and remove active call
      await updateDmConversation(conversationId, {
        activeCall: null,
        callHistory: [
          ...(conversation.callHistory || []),
          {
            initiator: conversation.activeCall.initiator,
            startTime: conversation.activeCall.startTime,
            endTime: new Date().toISOString(),
            duration: callDuration,
            status: "completed",
          },
        ],
      });

      // Emit event to recipient
      io.to(recipient.socketId).emit("directCallEnded", {
        callerId: user.id,
        conversationId,
        duration: callDuration,
      });

      console.log(
        `Call between ${user.username} and ${recipient.username} ended. Duration: ${callDuration}s`
      );
    } catch (error) {
      console.error("Error ending direct call:", error);
      socket.emit("error", { message: "Failed to end call" });
    }
  });

  /**
   * Handle WebRTC ICE candidates
   * @param {Object} data - ICE candidate data
   */
  socket.on("directCallIceCandidate", async (data) => {
    try {
      const { recipientId, conversationId, candidate } = data;

      // Get recipient user data
      const recipient = await getUserById(recipientId);
      if (!recipient) {
        return socket.emit("error", { message: "Recipient user not found" });
      }

      // Forward ICE candidate to recipient
      io.to(recipient.socketId).emit("directCallIceCandidate", {
        senderId: user.id,
        conversationId,
        candidate,
      });
    } catch (error) {
      console.error("Error handling ICE candidate:", error);
      socket.emit("error", { message: "Failed to process ICE candidate" });
    }
  });
}

module.exports = { initDmVoiceHandlers };
