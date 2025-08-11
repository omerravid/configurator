# Embedded MongoDB Setup

The Configuration Manager now uses **embedded MongoDB by default** - no external setup required!

## Default Setup (Embedded MongoDB)

The application now starts with embedded MongoDB automatically:

1. **Install dependencies**: `npm install`
2. **Start the application**: `npm run dev`
3. **That's it!** - Embedded MongoDB starts automatically

### What happens automatically:
- ✅ MongoDB binaries are downloaded on first run
- ✅ Embedded MongoDB server starts on a local port
- ✅ Database is initialized with default admin user
- ✅ Sample configurations are created
- ✅ No configuration required

## External MongoDB (Optional)

If you prefer to use your own MongoDB server for production:

### Option 1: Docker
```bash
# Start MongoDB in Docker
docker run --name config-mongo -p 27017:27017 -d mongo:latest

# Verify it's running
docker ps
```

### Option 2: Local Installation

#### On macOS:
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

#### On Ubuntu/Debian:
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
```

#### On Windows:
Download and install from: https://www.mongodb.com/try/download/community

### Option 3: Cloud MongoDB Atlas
1. Go to https://cloud.mongodb.com/
2. Create a free cluster
3. Get your connection string
4. Configure via admin settings panel

## Switching to External MongoDB:

1. **Disable embedded MongoDB**: Set `USE_MONGODB=false` in environment
2. **Configure external connection**: Add `MONGODB_URI=your-connection-string`
3. **Restart the server**: `npm run dev`

## Connection String Examples:

- **Local**: `mongodb://localhost:27017/config_manager`
- **Docker**: `mongodb://localhost:27017/config_manager`
- **Atlas**: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/config_manager`
- **Auth**: `mongodb://username:password@localhost:27017/config_manager`

## Default Credentials:

After starting the application:
- **Username**: `admin`
- **Password**: `admin123`

## Embedded vs External MongoDB:

| Feature | Embedded | External |
|---------|----------|----------|
| Setup Required | ❌ None | ✅ Manual |
| Production Ready | ⚠️ Development | ✅ Yes |
| Data Persistence | ⚠️ In-memory | ✅ Persistent |
| Performance | ⚠️ Limited | ✅ Optimized |
| Backup/Restore | ⚠️ Manual | ✅ Native tools |

## Troubleshooting:

### Embedded MongoDB Issues:
- Ensure 100MB+ disk space for MongoDB binaries
- Check Node.js version (18+ required)
- Review console logs for startup errors

### External MongoDB Issues:
- Verify MongoDB server is running
- Check connection string format
- Ensure network connectivity
- Review authentication credentials
