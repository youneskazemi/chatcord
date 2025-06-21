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

## License

MIT
