# Biscord

A Discord-like chat application with voice chat functionality.

## Features

- Real-time messaging with Socket.IO
- Direct messaging between users
- Channel-based chat rooms
- Voice chat using WebRTC
- User authentication
- Message reactions and editing
- Persistent message history
- Mobile responsive design

## Project Structure

```
biscord/
├── public/            # Static frontend files
│   ├── css/           # CSS stylesheets
│   ├── js/            # Client-side JavaScript
│   └── index.html     # Main HTML file
├── src/               # Server-side code
│   ├── config/        # Configuration files
│   │   └── database.js # Database configuration
│   ├── controllers/   # Controller logic
│   ├── models/        # Database models
│   │   ├── channels.js # Channel-related operations
│   │   ├── directMessages.js # DM-related operations
│   │   ├── messages.js # Message-related operations
│   │   ├── schema.js  # Database schema
│   │   └── users.js   # User-related operations
│   ├── routes/        # API routes
│   │   └── api.js     # API endpoints
│   ├── socket/        # Socket.IO handlers
│   │   ├── handlers.js # Socket event handlers
│   │   └── index.js   # Socket initialization
│   ├── utils/         # Utility functions
│   ├── middleware/    # Express middleware
│   └── index.js       # Main server file
├── chatcord.db        # SQLite database
├── package.json       # Project dependencies
└── README.md          # Project documentation
```

## Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/biscord.git
cd biscord
```

2. Install dependencies:

```bash
npm install
```

3. Start the server:

```bash
npm start
```

For development with auto-restart:

```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:3000`

## Technologies Used

- Node.js
- Express
- Socket.IO
- SQLite
- WebRTC
- HTML/CSS/JavaScript

## Next Steps and Future Improvements

### Immediate Next Steps

1. **Deploy with HTTPS**: Set up a proper HTTPS environment for production to ensure WebRTC works correctly
2. **Add Unit Tests**: Implement testing for core functionality
3. **Improve Error Handling**: Add more robust error handling throughout the application

### Future Features

1. **Screen Sharing**: Add screen sharing capability to voice channels
2. **Video Chat**: Extend voice chat to include video functionality
3. **File Uploads**: Allow users to share files in channels and DMs
4. **Message Threading**: Add support for threaded conversations
5. **User Roles and Permissions**: Implement admin and moderator roles
6. **Server/Guild System**: Allow users to create and join multiple servers
7. **Emoji Reactions**: Expand the reaction system with custom emojis
8. **Push Notifications**: Add support for browser notifications
9. **Message Search**: Implement full-text search for messages
10. **User Status**: Add custom status messages and presence indicators

## Known Issues

- Voice chat requires HTTPS in production environments (works on localhost without HTTPS)
- Some browsers may require additional permissions for microphone access

## License

MIT
"3. **1-to-1 Voice Chat in DMs**: Enable private voice calls between users in direct messages" 
