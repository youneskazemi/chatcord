/**
 * Direct Message Voice Chat Implementation
 * Handles 1-to-1 voice calls between users in direct messages
 */

class DMVoiceChat {
  constructor(socket, userId) {
    this.socket = socket;
    this.userId = userId;
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.currentCallData = null;
    this.isCallActive = false;
    this.callDuration = 0;
    this.callTimer = null;

    this.rtcConfig = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ],
      iceCandidatePoolSize: 10,
    };

    this.initSocketListeners();
  }

  /**
   * Initialize socket event listeners for call signaling
   */
  initSocketListeners() {
    // Incoming call
    this.socket.on("directCallOffer", (data) => {
      this.handleIncomingCall(data);
    });

    // Call accepted
    this.socket.on("directCallAccepted", (data) => {
      this.handleCallAccepted(data);
    });

    // Call rejected
    this.socket.on("directCallRejected", (data) => {
      this.handleCallRejected(data);
    });

    // Call ended
    this.socket.on("directCallEnded", (data) => {
      this.handleCallEnded(data);
    });

    // WebRTC signaling
    this.socket.on("directCallIceCandidate", (data) => {
      this.handleIceCandidate(data);
    });

    this.socket.on("directCallSdpAnswer", (data) => {
      this.handleRemoteSdp(data);
    });
  }

  /**
   * Initiate a call to another user
   * @param {string} recipientId - User ID of the call recipient
   * @param {string} conversationId - DM conversation ID
   */
  async initiateCall(recipientId, conversationId) {
    try {
      // Get user media (audio only)
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      // Create and display the outgoing call UI
      this.showOutgoingCallUI(recipientId);

      // Create RTCPeerConnection
      this.createPeerConnection();

      // Add tracks to the peer connection
      this.localStream.getAudioTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      // Create offer
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });

      await this.peerConnection.setLocalDescription(offer);

      // Send the offer to the recipient via the server
      this.socket.emit("initiateDirectCall", {
        recipientId,
        conversationId,
        sdp: offer,
      });

      this.currentCallData = {
        recipientId,
        conversationId,
        initiator: true,
      };
    } catch (error) {
      console.error("Error initiating call:", error);
      this.showErrorMessage(
        "Could not access microphone. Please check your permissions."
      );
      this.endCall();
    }
  }

  /**
   * Handle an incoming call
   * @param {Object} data - Call data including caller info and SDP offer
   */
  async handleIncomingCall(data) {
    const { callerId, callerName, callerAvatar, conversationId, sdp } = data;

    // Store call data
    this.currentCallData = {
      callerId,
      callerName,
      callerAvatar,
      conversationId,
      initiator: false,
      remoteDescription: sdp,
    };

    // Show incoming call UI
    this.showIncomingCallUI(data);

    // Play ringtone
    this.playRingtone();
  }

  /**
   * Accept an incoming call
   */
  async acceptCall() {
    try {
      // Stop ringtone
      this.stopRingtone();

      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      // Create peer connection
      this.createPeerConnection();

      // Add tracks
      this.localStream.getAudioTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      // Set remote description (the offer)
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(this.currentCallData.remoteDescription)
      );

      // Create answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      // Send answer to caller
      this.socket.emit("acceptDirectCall", {
        callerId: this.currentCallData.callerId,
        conversationId: this.currentCallData.conversationId,
        sdp: answer,
      });

      // Show active call UI
      this.showActiveCallUI();

      // Start call timer
      this.startCallTimer();

      this.isCallActive = true;
    } catch (error) {
      console.error("Error accepting call:", error);
      this.showErrorMessage(
        "Could not access microphone. Please check your permissions."
      );
      this.rejectCall();
    }
  }

  /**
   * Reject an incoming call
   */
  rejectCall() {
    // Stop ringtone
    this.stopRingtone();

    // Send rejection to caller
    this.socket.emit("rejectDirectCall", {
      callerId: this.currentCallData.callerId,
      conversationId: this.currentCallData.conversationId,
    });

    // Hide incoming call UI
    this.hideIncomingCallUI();

    // Reset call data
    this.currentCallData = null;
  }

  /**
   * Handle when a call is accepted by the recipient
   * @param {Object} data - Call acceptance data
   */
  async handleCallAccepted(data) {
    // Hide outgoing call UI
    this.hideOutgoingCallUI();

    // Set remote description (the answer)
    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription(data.sdp)
    );

    // Show active call UI
    this.showActiveCallUI();

    // Start call timer
    this.startCallTimer();

    this.isCallActive = true;
  }

  /**
   * Handle when a call is rejected by the recipient
   */
  handleCallRejected() {
    // Hide outgoing call UI
    this.hideOutgoingCallUI();

    // Show rejection message
    this.showRejectionMessage();

    // Clean up resources
    this.cleanupCall();
  }

  /**
   * End the current call
   */
  endCall() {
    if (!this.currentCallData) return;

    // Send end call event to the other user
    this.socket.emit("endDirectCall", {
      recipientId: this.currentCallData.initiator
        ? this.currentCallData.recipientId
        : this.currentCallData.callerId,
      conversationId: this.currentCallData.conversationId,
    });

    // Handle local call end
    this.handleCallEnded();
  }

  /**
   * Handle when a call is ended (either by local user or remote user)
   */
  handleCallEnded() {
    // Stop call timer
    this.stopCallTimer();

    // Hide active call UI
    this.hideActiveCallUI();

    // Clean up resources
    this.cleanupCall();

    // Show call ended message
    this.showCallEndedMessage(this.callDuration);

    this.isCallActive = false;
  }

  /**
   * Create the WebRTC peer connection
   */
  createPeerConnection() {
    this.peerConnection = new RTCPeerConnection(this.rtcConfig);

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const recipientId = this.currentCallData.initiator
          ? this.currentCallData.recipientId
          : this.currentCallData.callerId;

        this.socket.emit("directCallIceCandidate", {
          recipientId,
          conversationId: this.currentCallData.conversationId,
          candidate: event.candidate,
        });
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log("Connection state:", this.peerConnection.connectionState);
      if (
        this.peerConnection.connectionState === "disconnected" ||
        this.peerConnection.connectionState === "failed"
      ) {
        this.handleCallEnded();
      }
    };

    // Handle incoming tracks
    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      const remoteAudio = document.getElementById("dm-remote-audio");
      if (remoteAudio) {
        remoteAudio.srcObject = this.remoteStream;
      }
    };
  }

  /**
   * Handle incoming ICE candidates
   * @param {Object} data - ICE candidate data
   */
  async handleIceCandidate(data) {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.addIceCandidate(
        new RTCIceCandidate(data.candidate)
      );
    } catch (error) {
      console.error("Error adding ICE candidate:", error);
    }
  }

  /**
   * Handle incoming remote SDP
   * @param {Object} data - SDP data
   */
  async handleRemoteSdp(data) {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.sdp)
      );
    } catch (error) {
      console.error("Error setting remote description:", error);
    }
  }

  /**
   * Start the call duration timer
   */
  startCallTimer() {
    this.callDuration = 0;
    this.callTimer = setInterval(() => {
      this.callDuration++;
      this.updateCallDurationDisplay();
    }, 1000);
  }

  /**
   * Stop the call duration timer
   */
  stopCallTimer() {
    if (this.callTimer) {
      clearInterval(this.callTimer);
      this.callTimer = null;
    }
  }

  /**
   * Update the call duration display
   */
  updateCallDurationDisplay() {
    const durationElement = document.getElementById("dm-call-duration");
    if (durationElement) {
      const minutes = Math.floor(this.callDuration / 60);
      const seconds = this.callDuration % 60;
      durationElement.textContent = `${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
  }

  /**
   * Clean up call resources
   */
  cleanupCall() {
    // Stop local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    this.currentCallData = null;
    this.callDuration = 0;
  }

  /**
   * Toggle mute state
   */
  toggleMute() {
    if (!this.localStream) return;

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return !audioTrack.enabled; // Return new mute state
    }
    return false;
  }

  /**
   * Play ringtone for incoming calls
   */
  playRingtone() {
    const ringtone = document.getElementById("dm-ringtone");
    if (ringtone) {
      ringtone
        .play()
        .catch((err) => console.error("Failed to play ringtone:", err));
    }
  }

  /**
   * Stop ringtone
   */
  stopRingtone() {
    const ringtone = document.getElementById("dm-ringtone");
    if (ringtone) {
      ringtone.pause();
      ringtone.currentTime = 0;
    }
  }

  // UI METHODS

  /**
   * Show the outgoing call UI
   * @param {string} recipientId - User ID of call recipient
   */
  showOutgoingCallUI(recipientId) {
    // Implementation will depend on your UI structure
    // This is a placeholder for the actual implementation
    console.log("Showing outgoing call UI for recipient:", recipientId);

    // Create outgoing call container
    const outgoingCallContainer = document.createElement("div");
    outgoingCallContainer.id = "dm-outgoing-call-container";
    outgoingCallContainer.className = "dm-call-container";

    // Add content to the container
    outgoingCallContainer.innerHTML = `
      <div class="dm-call-header">
        <h3>Calling...</h3>
      </div>
      <div class="dm-call-body">
        <div class="dm-call-avatar">
          <img src="/img/avatars/default.png" alt="User avatar">
        </div>
        <div class="dm-call-status">Ringing...</div>
      </div>
      <div class="dm-call-actions">
        <button id="dm-end-call-btn" class="dm-call-btn dm-end-call">
          <i class="fas fa-phone-slash"></i> End Call
        </button>
      </div>
    `;

    // Add to DOM
    document.body.appendChild(outgoingCallContainer);

    // Add event listener for end call button
    document.getElementById("dm-end-call-btn").addEventListener("click", () => {
      this.endCall();
    });
  }

  /**
   * Hide the outgoing call UI
   */
  hideOutgoingCallUI() {
    const outgoingCallContainer = document.getElementById(
      "dm-outgoing-call-container"
    );
    if (outgoingCallContainer) {
      outgoingCallContainer.remove();
    }
  }

  /**
   * Show the incoming call UI
   * @param {Object} data - Call data including caller info
   */
  showIncomingCallUI(data) {
    const { callerName, callerAvatar } = data;

    // Create incoming call container
    const incomingCallContainer = document.createElement("div");
    incomingCallContainer.id = "dm-incoming-call-container";
    incomingCallContainer.className = "dm-call-container";

    // Add content to the container
    incomingCallContainer.innerHTML = `
      <div class="dm-call-header">
        <h3>Incoming Call</h3>
      </div>
      <div class="dm-call-body">
        <div class="dm-call-avatar">
          <img src="${
            callerAvatar || "/img/avatars/default.png"
          }" alt="${callerName}'s avatar">
        </div>
        <div class="dm-call-user">${callerName}</div>
      </div>
      <div class="dm-call-actions">
        <button id="dm-accept-call-btn" class="dm-call-btn dm-accept-call">
          <i class="fas fa-phone"></i> Accept
        </button>
        <button id="dm-reject-call-btn" class="dm-call-btn dm-reject-call">
          <i class="fas fa-phone-slash"></i> Decline
        </button>
      </div>
      <audio id="dm-ringtone" loop>
        <source src="/audio/ringtone.mp3" type="audio/mp3">
      </audio>
    `;

    // Add to DOM
    document.body.appendChild(incomingCallContainer);

    // Add event listeners
    document
      .getElementById("dm-accept-call-btn")
      .addEventListener("click", () => {
        this.acceptCall();
      });

    document
      .getElementById("dm-reject-call-btn")
      .addEventListener("click", () => {
        this.rejectCall();
      });
  }

  /**
   * Hide the incoming call UI
   */
  hideIncomingCallUI() {
    const incomingCallContainer = document.getElementById(
      "dm-incoming-call-container"
    );
    if (incomingCallContainer) {
      incomingCallContainer.remove();
    }
  }

  /**
   * Show the active call UI
   */
  showActiveCallUI() {
    // Hide any existing call UIs
    this.hideOutgoingCallUI();
    this.hideIncomingCallUI();

    // Create active call container
    const activeCallContainer = document.createElement("div");
    activeCallContainer.id = "dm-active-call-container";
    activeCallContainer.className = "dm-call-container";

    // Determine the other user's name
    const otherUserName = this.currentCallData.initiator
      ? "User" // This should be replaced with actual recipient name
      : this.currentCallData.callerName;

    // Add content to the container
    activeCallContainer.innerHTML = `
      <div class="dm-call-header">
        <h3>Call with ${otherUserName}</h3>
        <div id="dm-call-duration">00:00</div>
      </div>
      <div class="dm-call-body">
        <div class="dm-call-avatar">
          <img src="/img/avatars/default.png" alt="User avatar">
        </div>
        <div class="dm-call-status">Connected</div>
      </div>
      <div class="dm-call-actions">
        <button id="dm-toggle-mute-btn" class="dm-call-btn dm-toggle-mute">
          <i class="fas fa-microphone"></i> Mute
        </button>
        <button id="dm-end-active-call-btn" class="dm-call-btn dm-end-call">
          <i class="fas fa-phone-slash"></i> End Call
        </button>
      </div>
      <audio id="dm-remote-audio" autoplay></audio>
    `;

    // Add to DOM
    document.body.appendChild(activeCallContainer);

    // Add event listeners
    document
      .getElementById("dm-toggle-mute-btn")
      .addEventListener("click", () => {
        const isMuted = this.toggleMute();
        const muteBtn = document.getElementById("dm-toggle-mute-btn");
        if (isMuted) {
          muteBtn.innerHTML = '<i class="fas fa-microphone-slash"></i> Unmute';
        } else {
          muteBtn.innerHTML = '<i class="fas fa-microphone"></i> Mute';
        }
      });

    document
      .getElementById("dm-end-active-call-btn")
      .addEventListener("click", () => {
        this.endCall();
      });
  }

  /**
   * Hide the active call UI
   */
  hideActiveCallUI() {
    const activeCallContainer = document.getElementById(
      "dm-active-call-container"
    );
    if (activeCallContainer) {
      activeCallContainer.remove();
    }
  }

  /**
   * Show error message
   * @param {string} message - Error message to display
   */
  showErrorMessage(message) {
    // Implementation will depend on your UI structure
    console.error("Call error:", message);
    alert(`Call error: ${message}`);
  }

  /**
   * Show call rejection message
   */
  showRejectionMessage() {
    console.log("Call was rejected");
    // You can implement a more sophisticated UI notification here
    setTimeout(() => {
      alert("Call was declined");
    }, 100);
  }

  /**
   * Show call ended message
   * @param {number} duration - Call duration in seconds
   */
  showCallEndedMessage(duration) {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    const durationStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;

    console.log(`Call ended. Duration: ${durationStr}`);
    // You can implement a more sophisticated UI notification here
  }
}

// Export the class
window.DMVoiceChat = DMVoiceChat;
