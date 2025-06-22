const bcrypt = require("bcryptjs");
const { db, dbAsync } = require("../config/database");
const { activeUsers } = require("../models/users");
const { getChannelMessages } = require("../models/messages");
const {
  getChannelUsers,
  updateAllChannelUserLists,
} = require("../models/channels");
const {
  getUserDMConversations,
  getOrCreateDMConversation,
  handleDirectMessage,
} = require("../models/directMessages");
const { getDMMessages, markDmMessagesAsRead } = require("../models/messages");
const {
  getUserByUsername,
  getUserById,
  createUser,
  updateUserPassword,
  updateUserOnlineStatus,
  createUserSession,
  removeUserSession,
  updateUserSessionChannel,
  updateUserVoiceChatStatus,
  getAllUsers,
} = require("../models/users");

// Helper functions
async function getDefaultChannel() {
  return await dbAsync.get("SELECT * FROM channels WHERE name = ?", [
    "general",
  ]);
}

async function getChannelByName(channelName) {
  return await dbAsync.get("SELECT * FROM channels WHERE name = ?", [
    channelName,
  ]);
}

async function saveChannelMessage(userId, channelId, content) {
  const result = await dbAsync.run(
    "INSERT INTO messages (user_id, channel_id, content) VALUES (?, ?, ?)",
    [userId, channelId, content]
  );
  return result;
}

async function getDMConversation(conversationId, userId) {
  return await dbAsync.get(
    "SELECT * FROM dm_conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)",
    [conversationId, userId, userId]
  );
}

function registerSocketHandlers(io, socket) {
  // User joins with username
  socket.on("join", async ({ username, password, isLogin }) => {
    try {
      let user = await getUserByUsername(username);

      if (isLogin) {
        // LOGIN MODE: User is trying to log in to existing account
        if (!user) {
          socket.emit("joinError", {
            message:
              "Username not found. Please check your username or create a new account.",
          });
          return;
        }

        if (!user.password_hash) {
          socket.emit("joinError", {
            message:
              "This account has no password set. Please use the register tab.",
          });
          return;
        }

        if (!password) {
          socket.emit("joinError", {
            message: "Password is required for this account.",
          });
          return;
        }

        const validPassword = bcrypt.compareSync(password, user.password_hash);
        if (!validPassword) {
          socket.emit("joinError", {
            message: "Incorrect password. Please try again.",
          });
          return;
        }

        console.log(`${username} logged in successfully`);
      } else {
        // REGISTER MODE: User is creating new account or joining without password
        if (user) {
          if (user.password_hash) {
            socket.emit("joinError", {
              message:
                "Username already exists with a password. Please use the login tab.",
            });
            return;
          } else if (password) {
            // User wants to add password to existing account
            await updateUserPassword(user.id, password);
            console.log(`${username} added password to existing account`);
          }
        } else {
          // Create completely new user
          user = await createUser(username, password);
          console.log(
            `${username} created new account ${
              password ? "with" : "without"
            } password`
          );
        }
      }

      // Update user online status
      await updateUserOnlineStatus(user.id, true);

      // Get default channel (general)
      const defaultChannel = await getDefaultChannel();

      // Create user session
      await createUserSession(user.id, socket.id, defaultChannel.id);

      // Store active user data
      const userSession = {
        id: user.id,
        username: user.username,
        color: user.color,
        socketId: socket.id,
        currentChannelId: defaultChannel.id,
        inVoiceChat: false,
        voiceChannelId: null,
      };

      activeUsers.set(socket.id, userSession);

      // Join default channel room
      socket.join(`channel_${defaultChannel.id}`);

      // Get recent messages for the channel
      const messages = await getChannelMessages(defaultChannel.id);

      // Get online users in the channel
      const channelUsers = await getChannelUsers(defaultChannel.id);

      // Notify others in channel about new user
      socket.to(`channel_${defaultChannel.id}`).emit("userJoined", {
        username: user.username,
        userId: user.id,
      });

      // Send user their info and channel data
      socket.emit("joinSuccess", {
        user: userSession,
        channel: defaultChannel,
        messages: messages,
        users: channelUsers,
      });

      // Get and send the user's DM conversations
      const dmConversations = await getUserDMConversations(user.id);
      socket.emit("dmConversations", dmConversations);
      socket.emit("dmConversationsList", dmConversations);

      // Also load all users for DM search
      const allUsers = await getAllUsers(user.id);
      socket.emit("allUsers", { users: allUsers });

      // Send updated user list to all users in channel
      io.to(`channel_${defaultChannel.id}`).emit(
        "updateUserList",
        channelUsers
      );
    } catch (error) {
      console.error("Error during user join:", error);
      socket.emit("joinError", { message: "Server error. Please try again." });
    }
  });

  // Handle channel switching
  socket.on("switchChannel", async ({ channelName }) => {
    const userSession = activeUsers.get(socket.id);
    if (!userSession) return;

    try {
      const newChannel = await getChannelByName(channelName);

      if (!newChannel) return;

      const oldChannelId = userSession.currentChannelId;

      // Leave old channel room
      socket.leave(`channel_${oldChannelId}`);

      // Join new channel room
      socket.join(`channel_${newChannel.id}`);

      // Update user session
      userSession.currentChannelId = newChannel.id;
      await updateUserSessionChannel(socket.id, newChannel.id);

      // Get channel data
      const messages = await getChannelMessages(newChannel.id);
      const users = await getChannelUsers(newChannel.id);

      // Send channel data to user
      socket.emit("channelSwitched", {
        channel: newChannel,
        messages: messages,
        users: users,
      });

      // Update user lists in both channels
      const oldChannelUsers = await getChannelUsers(oldChannelId);
      const newChannelUsers = await getChannelUsers(newChannel.id);

      io.to(`channel_${oldChannelId}`).emit("updateUserList", oldChannelUsers);
      io.to(`channel_${newChannel.id}`).emit("updateUserList", newChannelUsers);
    } catch (error) {
      console.error("Error switching channel:", error);
    }
  });

  // Handle new messages
  socket.on(
    "sendMessage",
    async ({ text, channelName, isDM, targetUserId }) => {
      const userSession = activeUsers.get(socket.id);
      if (!userSession) return;

      try {
        if (isDM && targetUserId) {
          // Handle direct message
          const { conversation, message } = await handleDirectMessage(
            userSession,
            targetUserId,
            text.trim(),
            socket,
            io
          );

          // Send to both users in the DM
          io.to(`dm_${conversation.id}`).emit("newDMMessage", {
            message,
            conversationId: conversation.id,
          });

          // Get target user info to notify about new DM
          const targetUser = await getUserById(targetUserId);
          const targetSocketId = Array.from(activeUsers.entries()).find(
            ([socketId, user]) => user.id === targetUserId
          )?.[0];

          // Check if target user is actively viewing this conversation
          const targetSession = targetSocketId
            ? activeUsers.get(targetSocketId)
            : null;
          const isTargetViewingConversation =
            targetSession &&
            targetSession.currentDMConversationId === conversation.id;

          // If target is viewing the conversation, mark as read immediately
          if (isTargetViewingConversation) {
            await markDmMessagesAsRead(conversation.id, targetUserId);

            // Notify sender that message was read
            socket.emit("dmMessagesRead", {
              conversationId: conversation.id,
              readerId: targetUserId,
              readAt: new Date().toISOString(),
            });
          }

          if (targetSocketId && targetUser) {
            // Notify target user about new DM conversation if they're online
            io.to(targetSocketId).emit("newDMNotification", {
              conversation: {
                id: conversation.id,
                targetUser: {
                  id: userSession.id,
                  username: userSession.username,
                  color: userSession.color,
                },
              },
              message,
            });
          }
        } else {
          // Handle regular channel message
          const channel = await getChannelByName(channelName);

          if (!channel) return;

          // Save message to database
          const result = await saveChannelMessage(
            userSession.id,
            channel.id,
            text.trim()
          );

          // Create message object with the correct format
          const message = {
            id: result.id,
            content: text.trim(),
            created_at: new Date().toISOString(),
            user: {
              id: userSession.id,
              username: userSession.username,
              color: userSession.color,
            },
            reactions: {},
          };

          // Broadcast message to all users in channel
          io.to(`channel_${channel.id}`).emit("newMessage", message);
        }
      } catch (error) {
        console.error("Error sending message:", error);
      }
    }
  );

  // Get user's DM conversations
  socket.on("getDMConversations", async () => {
    try {
      const userSession = activeUsers.get(socket.id);
      if (!userSession) return;

      const conversations = await getUserDMConversations(userSession.id);
      // Emit both events for backward compatibility
      socket.emit("dmConversations", conversations);
      socket.emit("dmConversationsList", conversations);
    } catch (error) {
      console.error("Error fetching DM conversations:", error);
    }
  });

  // Get all users for DM search
  socket.on("getAllUsers", async () => {
    const userSession = activeUsers.get(socket.id);
    if (!userSession) return;

    try {
      const users = await getAllUsers(userSession.id);
      socket.emit("allUsers", { users });
    } catch (error) {
      console.error("Error getting all users:", error);
    }
  });

  // Create or get DM conversation
  socket.on("createDMConversation", async ({ targetUserId }) => {
    const userSession = activeUsers.get(socket.id);
    if (!userSession) return;

    try {
      const conversation = await getOrCreateDMConversation(
        userSession.id,
        targetUserId
      );
      const messages = await getDMMessages(conversation.id);

      // Get target user info
      const targetUser = await getUserById(targetUserId);

      if (targetUser) {
        socket.emit("dmConversationCreated", {
          conversation: {
            id: conversation.id,
            targetUser: {
              id: targetUser.id,
              username: targetUser.username,
              color: targetUser.color,
            },
          },
          messages: messages,
        });
      }
    } catch (error) {
      console.error("Error creating DM conversation:", error);
    }
  });

  // Switch to DM conversation
  socket.on("switchToDM", async ({ conversationId }) => {
    const userSession = activeUsers.get(socket.id);
    if (!userSession) return;

    try {
      // Verify user is part of this conversation
      const conversation = await getDMConversation(
        conversationId,
        userSession.id
      );

      if (!conversation) return;

      // Leave current channel
      if (userSession.currentChannelId) {
        socket.leave(`channel_${userSession.currentChannelId}`);
      }

      // Join DM room
      socket.join(`dm_${conversationId}`);

      // Update session
      userSession.currentChannelId = null;
      userSession.currentDMConversationId = conversationId;

      // Get messages and target user info
      const messages = await getDMMessages(conversationId);
      const targetUserId =
        conversation.user1_id === userSession.id
          ? conversation.user2_id
          : conversation.user1_id;
      const targetUser = await getUserById(targetUserId);

      // Mark unread messages as read
      await markDmMessagesAsRead(conversationId, userSession.id);

      socket.emit("dmSwitched", {
        conversation: {
          id: conversationId,
          targetUser: {
            id: targetUser.id,
            username: targetUser.username,
            color: targetUser.color,
          },
        },
        messages: messages,
      });

      // Notify the other user that their messages have been read
      const targetSocketId = Array.from(activeUsers.entries()).find(
        ([socketId, user]) => user.id === targetUserId
      )?.[0];

      if (targetSocketId) {
        io.to(targetSocketId).emit("dmMessagesRead", {
          conversationId: conversationId,
          readerId: userSession.id,
          readAt: new Date().toISOString(),
        });
      }

      // Update user lists in previous channel
      if (userSession.currentChannelId) {
        const channelUsers = await getChannelUsers(
          userSession.currentChannelId
        );
        io.to(`channel_${userSession.currentChannelId}`).emit(
          "updateUserList",
          channelUsers
        );
      }
    } catch (error) {
      console.error("Error switching to DM:", error);
    }
  });

  // Mark DM messages as read
  socket.on("markDMRead", async (data) => {
    try {
      const userSession = activeUsers.get(socket.id);
      if (!userSession) return;

      const { conversationId } = data;

      // Verify user is part of this conversation
      const conversation = await getDMConversation(
        conversationId,
        userSession.id
      );

      if (!conversation) return;

      // Mark messages as read
      const updatedCount = await markDmMessagesAsRead(
        conversationId,
        userSession.id
      );

      if (updatedCount > 0) {
        // Find the other user in the conversation
        const otherUserId =
          conversation.user1_id === userSession.id
            ? conversation.user2_id
            : conversation.user1_id;

        // Find the other user's socket if they're online
        const otherUserSocketId = Array.from(activeUsers.entries()).find(
          ([socketId, user]) => user.id === otherUserId
        )?.[0];

        // Notify the other user that their messages were read
        if (otherUserSocketId) {
          io.to(otherUserSocketId).emit("dmMessagesRead", {
            conversationId,
            readerId: userSession.id,
            readAt: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error("Error marking DM as read:", error);
    }
  });

  // Handle typing indicators
  socket.on("typing", ({ channelName }) => {
    const userSession = activeUsers.get(socket.id);
    if (!userSession) return;

    socket.to(`channel_${userSession.currentChannelId}`).emit("userTyping", {
      username: userSession.username,
      userId: userSession.id,
    });
  });

  socket.on("stopTyping", ({ channelName }) => {
    const userSession = activeUsers.get(socket.id);
    if (!userSession) return;

    socket
      .to(`channel_${userSession.currentChannelId}`)
      .emit("userStoppedTyping", {
        userId: userSession.id,
      });
  });

  // Handle disconnection
  socket.on("disconnect", async () => {
    const userSession = activeUsers.get(socket.id);
    if (userSession) {
      try {
        // Update user offline status
        await updateUserOnlineStatus(userSession.id, false);

        // Remove user session
        await removeUserSession(socket.id);

        // Notify channels
        socket.to(`channel_${userSession.currentChannelId}`).emit("userLeft", {
          username: userSession.username,
          userId: userSession.id,
        });

        // Notify voice channel if in one
        if (userSession.inVoiceChat && userSession.voiceChannelId) {
          socket
            .to(`voice_${userSession.voiceChannelId}`)
            .emit("userLeftVoice", {
              userId: userSession.id,
              username: userSession.username,
            });
        }

        activeUsers.delete(socket.id);
        await updateAllChannelUserLists(io);

        console.log(`${userSession.username} disconnected`);
      } catch (error) {
        console.error("Error during disconnect:", error);
      }
    }
  });
}

module.exports = {
  registerSocketHandlers,
};
