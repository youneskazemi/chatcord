# Voice Chat Debugging Guide

This guide will help you troubleshoot and fix voice chat issues in the Biscord application.

## Common Issues and Solutions

### 1. "Your browser doesn't support voice chat" Error

**Possible causes:**

- Using an unsupported browser
- Using HTTP instead of HTTPS (except on localhost)
- Browser permissions are blocked

**Solutions:**

- Use a modern browser like Chrome, Firefox, or Edge
- Ensure you're accessing the application via HTTPS or localhost
- Check browser permissions for microphone access

### 2. No Sound in Voice Chat

**Possible causes:**

- Microphone permissions not granted
- Microphone is muted in the application
- WebRTC connection issues
- Audio device issues

**Solutions:**

#### Check Microphone Permissions

1. Click the lock icon in the address bar
2. Ensure microphone permissions are set to "Allow"
3. Refresh the page after changing permissions

#### Check Application Settings

1. Make sure you're not muted in the application (check the mute button)
2. Try leaving and rejoining the voice channel

#### Check WebRTC Connection

1. Open browser developer tools (F12)
2. Go to the Console tab
3. Look for WebRTC-related errors
4. Check if ICE candidates are being generated and exchanged

#### Check Audio Devices

1. Make sure your microphone is properly connected
2. Test your microphone in another application
3. Check if the correct audio input device is selected in your browser settings

### 3. Voice Chat Disconnects Frequently

**Possible causes:**

- Network issues
- Firewall blocking WebRTC traffic
- STUN/TURN server issues

**Solutions:**

1. Check your internet connection
2. Ensure your firewall allows WebRTC traffic
3. Try using a different network

### 4. Echo or Feedback in Voice Chat

**Possible causes:**

- Multiple users in the same room with speakers on
- Microphone picking up speaker output

**Solutions:**

1. Use headphones instead of speakers
2. Adjust microphone sensitivity
3. Enable echo cancellation in the browser settings

## Browser-Specific Troubleshooting

### Chrome

1. Go to `chrome://settings/content/microphone`
2. Ensure the site is allowed to access the microphone
3. Try clearing browser cache and cookies

### Firefox

1. Go to `about:preferences#privacy`
2. Scroll to Permissions > Microphone
3. Ensure the site is allowed to access the microphone

### Edge

1. Go to `edge://settings/content/microphone`
2. Ensure the site is allowed to access the microphone

## Advanced Troubleshooting

### WebRTC Connection Debugging

1. Open browser developer tools
2. Go to the Console tab
3. Add these lines to your code for detailed logging:

```javascript
// Add to the script.js file
this.rtcConfig.sdpSemantics = "unified-plan";
this.rtcConfig.bundlePolicy = "max-bundle";

// Enable WebRTC logging
window.localStorage.setItem("debug", "*");
```

### ICE Connection Issues

If you see "ICE connection failed" errors:

1. Ensure your STUN servers are accessible
2. Consider adding TURN servers to your configuration:

```javascript
// Enhanced ICE servers configuration
const rtcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    // Add TURN servers for better connectivity
    {
      urls: "turn:your-turn-server.com:3478",
      username: "username",
      credential: "password",
    },
  ],
  iceCandidatePoolSize: 10,
};
```

### Testing WebRTC Connectivity

Use this online tool to test your WebRTC connectivity:
https://test.webrtc.org/

## Server-Side Debugging

### Check HTTPS Configuration

WebRTC requires HTTPS in production environments (except on localhost).

1. Verify SSL certificates are valid
2. Ensure proper CORS configuration
3. Check that WebSocket connections are properly secured

### Socket.IO Connection Issues

1. Check server logs for connection errors
2. Verify that the Socket.IO server is properly initialized
3. Ensure that the client is connecting to the correct Socket.IO endpoint

## Getting Help

If you're still experiencing issues after trying these solutions:

1. Check the browser console for specific error messages
2. Look at the server logs for any backend errors
3. Provide detailed information when seeking help, including:
   - Browser and version
   - Operating system
   - Error messages from the console
   - Steps to reproduce the issue
