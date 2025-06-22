# Deployment Guide for Biscord

This guide will help you deploy your Biscord application to a production environment with HTTPS, which is required for WebRTC voice chat to work properly.

## Prerequisites

- A domain name
- A server with Node.js installed (v14.0.0 or higher)
- Basic knowledge of server administration

## Deployment Options

### Option 1: Deploy to a VPS (Virtual Private Server)

1. **Set up your server**

   - Install Node.js, npm, and git
   - Install PM2 for process management: `npm install -g pm2`

2. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/biscord.git
   cd biscord
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:

   ```
   PORT=3000
   NODE_ENV=production
   ```

4. **Set up HTTPS with Let's Encrypt**

   - Install Certbot: `sudo apt-get install certbot`
   - Get a certificate: `sudo certbot certonly --standalone -d yourdomain.com`
   - Update the server code to use the certificates:

   ```javascript
   // In src/index.js
   const fs = require("fs");
   const https = require("https");

   // Load SSL certificates
   const privateKey = fs.readFileSync(
     "/etc/letsencrypt/live/yourdomain.com/privkey.pem",
     "utf8"
   );
   const certificate = fs.readFileSync(
     "/etc/letsencrypt/live/yourdomain.com/cert.pem",
     "utf8"
   );
   const ca = fs.readFileSync(
     "/etc/letsencrypt/live/yourdomain.com/chain.pem",
     "utf8"
   );

   const credentials = {
     key: privateKey,
     cert: certificate,
     ca: ca,
   };

   // Create HTTPS server instead of HTTP
   const server = https.createServer(credentials, app);
   ```

5. **Start the application with PM2**

   ```bash
   pm2 start src/index.js --name biscord
   pm2 save
   pm2 startup
   ```

6. **Set up Nginx as a reverse proxy (optional but recommended)**
   - Install Nginx: `sudo apt-get install nginx`
   - Configure Nginx to proxy requests to your Node.js application

### Option 2: Deploy to Heroku

1. **Create a Heroku account and install the Heroku CLI**

   - Sign up at [heroku.com](https://heroku.com)
   - Install the [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)

2. **Prepare your application for Heroku**

   - Make sure your `package.json` has a `start` script
   - Create a `Procfile` in the root directory:
     ```
     web: node src/index.js
     ```

3. **Create and deploy to Heroku**

   ```bash
   heroku login
   heroku create your-app-name
   git push heroku main
   ```

4. **Set up a custom domain with SSL**
   ```bash
   heroku domains:add yourdomain.com
   ```
   - Follow Heroku's instructions to configure your DNS settings
   - Enable SSL: `heroku certs:auto:enable`

### Option 3: Deploy to Vercel or Netlify

For frontend-only deployment, you can use Vercel or Netlify, but you'll need to host your backend separately.

## Database Considerations

The current application uses SQLite, which is fine for development but not ideal for production. Consider migrating to:

- PostgreSQL
- MySQL
- MongoDB

## Scaling Considerations

For a production application with many users:

1. **Use a load balancer** if deploying to multiple servers
2. **Implement Redis** for Socket.IO to handle multiple server instances
3. **Set up monitoring** using tools like PM2, New Relic, or Datadog
4. **Configure proper logging** for debugging and monitoring

## Security Considerations

1. **Enable CORS** properly for production
2. **Set up rate limiting** to prevent abuse
3. **Implement proper authentication** with JWT or sessions
4. **Sanitize user inputs** to prevent XSS and injection attacks
5. **Set secure and HTTP-only cookies** if using cookie-based authentication

## Backup Strategy

Regularly backup your database:

```bash
# Example SQLite backup
sqlite3 chatcord.db .dump > backup_$(date +%Y%m%d).sql
```

## Continuous Integration/Continuous Deployment (CI/CD)

Consider setting up CI/CD using:

- GitHub Actions
- GitLab CI
- Jenkins

This will automate testing and deployment when you push changes to your repository.

## Troubleshooting

### WebRTC Issues

- Ensure your server has HTTPS properly configured
- Check that all STUN/TURN servers are accessible
- Verify that your firewall allows WebRTC traffic

### Socket.IO Connection Issues

- Check for CORS issues
- Ensure proper proxy configuration if using Nginx or Apache
- Verify that WebSocket connections are allowed through your firewall

## Monitoring and Maintenance

- Set up uptime monitoring with tools like UptimeRobot or Pingdom
- Implement application monitoring with tools like PM2 or New Relic
- Regularly update dependencies to patch security vulnerabilities
