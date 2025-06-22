/**
 * DM Voice Chat Integration
 * Integrates the DM voice chat functionality with the main application
 */

document.addEventListener("DOMContentLoaded", () => {
  let dmVoiceChat = null;

  // Initialize DM voice chat when user is logged in
  function initializeDmVoiceChat(socket, userId) {
    if (!window.DMVoiceChat) {
      console.error("DMVoiceChat class not loaded");
      return;
    }

    dmVoiceChat = new window.DMVoiceChat(socket, userId);

    // Add call button to DM conversation header when it's rendered
    observeDmConversationHeader();
  }

  // Use MutationObserver to detect when DM conversation header is rendered
  function observeDmConversationHeader() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
          const dmHeader = document.querySelector(".dm-header");
          if (dmHeader && !dmHeader.querySelector(".dm-call-icon")) {
            addCallButtonToDmHeader(dmHeader);
          }
        }
      });
    });

    // Start observing the document body for changes
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Add call button to DM conversation header
  function addCallButtonToDmHeader(dmHeader) {
    const callButton = document.createElement("div");
    callButton.className = "dm-call-icon";
    callButton.innerHTML = '<i class="fas fa-phone"></i>';
    callButton.title = "Start Voice Call";

    // Add click event listener
    callButton.addEventListener("click", () => {
      // Get conversation ID and recipient ID from the current DM conversation
      const conversationId = getCurrentDmConversationId();
      const recipientId = getCurrentDmRecipientId();

      if (conversationId && recipientId && dmVoiceChat) {
        dmVoiceChat.initiateCall(recipientId, conversationId);
      } else {
        console.error(
          "Missing conversation ID, recipient ID, or dmVoiceChat not initialized"
        );
      }
    });

    // Add the button to the header
    dmHeader.appendChild(callButton);
  }

  // Get the current DM conversation ID
  function getCurrentDmConversationId() {
    // This implementation depends on how conversation IDs are stored in your application
    // For example, it might be stored as a data attribute on the conversation container
    const dmContainer = document.querySelector(".dm-messages-container");
    return dmContainer ? dmContainer.dataset.conversationId : null;
  }

  // Get the current DM recipient ID
  function getCurrentDmRecipientId() {
    // This implementation depends on how recipient IDs are stored in your application
    // For example, it might be stored as a data attribute on the conversation container
    const dmContainer = document.querySelector(".dm-messages-container");
    return dmContainer ? dmContainer.dataset.recipientId : null;
  }

  // Add necessary styles
  function addDmVoiceChatStyles() {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/css/dm-voice-chat.css";
    document.head.appendChild(link);
  }

  // Add ringtone audio element
  function addRingtoneAudio() {
    const audio = document.createElement("audio");
    audio.id = "dm-ringtone";
    audio.preload = "auto";
    audio.innerHTML = '<source src="/audio/ringtone.mp3" type="audio/mp3">';
    document.body.appendChild(audio);
  }

  // Expose the initialization function to the global scope
  window.initializeDmVoiceChat = initializeDmVoiceChat;

  // Add styles when the document loads
  addDmVoiceChatStyles();

  // Add ringtone audio element
  addRingtoneAudio();
});
