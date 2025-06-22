# 1-to-1 Voice Chat in Direct Messages

This document outlines the implementation plan for adding private voice calls between users in direct messages.

## Overview

The 1-to-1 voice chat feature will allow users to initiate private voice calls directly from their DM conversations. This feature will leverage the existing WebRTC infrastructure used for channel-based voice chat, but will be optimized for direct peer-to-peer connections between just two users.

## User Interface Changes

1. **Call Button in DM Header**

   - Add a phone/call icon button in the DM conversation header
   - Include tooltip "Start Voice Call"

2. **Incoming Call UI**

   - Create a modal dialog for incoming calls showing caller's avatar and name
   - Add "Accept" and "Decline" buttons
   - Include ringtone audio

3. **Active Call UI**
   - Call duration timer
   - Mute button
   - End call button
   - Audio settings button (device selection)
   - Call status indicator

## Backend Changes

### Socket Events

1. **New Events**

   - `initiateDirectCall`: Sent by caller to server to initiate a call
   - `directCallOffer`: Sent by server to recipient with call details
   - `acceptDirectCall`: Sent by recipient to accept the call
   - `rejectDirectCall`: Sent by recipient to reject the call
   - `directCallAccepted`: Sent by server to caller when call is accepted
   - `directCallRejected`: Sent by server to caller when call is rejected
   - `endDirectCall`: Sent by either user to end the call
   - `directCallEnded`: Sent by server to notify the other user that call ended

2. **WebRTC Signaling Events**
   - `directCallIceCandidate`: For exchanging ICE candidates
   - `directCallSdpOffer`: For sending SDP offer
   - `directCallSdpAnswer`: For sending SDP answer

### Database Changes

Add a new table or modify the existing DM conversations table to track:

- Call status (active/inactive)
- Call start time
- Call duration

## Frontend Implementation

### JavaScript Functions

1. **Call Initiation**

   ```javascript
   function initiateDirectCall(recipientId) {
     // Create RTCPeerConnection
     // Set up local media stream
     // Emit socket event to initiate call
   }
   ```

2. **Call Reception**

   ```javascript
   function handleIncomingCall(callData) {
     // Show incoming call UI
     // Play ringtone
     // Set up accept/reject handlers
   }
   ```

3. **Call Connection**

   ```javascript
   function establishDirectCall() {
     // Exchange SDP and ICE candidates
     // Connect audio streams
     // Update UI to show active call
   }
   ```

4. **Call Termination**
   ```javascript
   function endDirectCall() {
     // Close peer connection
     // Release media streams
     // Emit socket event to end call
     // Update UI
   }
   ```

## CSS Changes

Add styles for:

- Call buttons
- Incoming call modal
- Active call UI elements
- Call status indicators

## Implementation Phases

### Phase 1: Basic Functionality

- Implement UI elements for initiating calls
- Add socket events for call signaling
- Implement basic WebRTC connection for audio

### Phase 2: Enhanced Features

- Add call notifications
- Implement call history
- Add missed call indicators
- Improve audio quality settings

### Phase 3: Refinements

- Add call duration limits (if needed)
- Implement analytics for call quality
- Add fallback mechanisms for connection issues
- Optimize for mobile devices

## Testing Plan

1. **Unit Tests**

   - Test socket event handlers
   - Test WebRTC connection setup
   - Test UI component rendering

2. **Integration Tests**

   - Test call flow between two users
   - Test reconnection scenarios
   - Test with different network conditions

3. **Browser Compatibility**
   - Test on Chrome, Firefox, Safari, and Edge
   - Test on mobile browsers

## Security Considerations

- Ensure all WebRTC connections are encrypted
- Implement proper authentication for call initiation
- Consider rate limiting to prevent call spam
- Ensure proper cleanup of media resources after calls

## Performance Considerations

- Optimize audio encoding for different network conditions
- Implement adaptive bitrate for varying connection speeds
- Minimize memory usage for long-running calls
- Ensure efficient handling of multiple concurrent calls
