# MongoDB Setup Instructions

The Configuration Manager is now ready to use MongoDB, but you'll need to set up MongoDB first.

## Option 1: Docker (Recommended)
```bash
# Start MongoDB in Docker
docker run --name config-mongo -p 27017:27017 -d mongo:latest

# Verify it's running
docker ps
```

## Option 2: Local Installation

### On macOS:
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

### On Ubuntu/Debian:
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
```

### On Windows:
Download and install from: https://www.mongodb.com/try/download/community

## Option 3: Cloud MongoDB Atlas
1. Go to https://cloud.mongodb.com/
2. Create a free cluster
3. Get your connection string
4. Update the connection string in the admin settings panel

## After MongoDB is running:

1. **Enable MongoDB**: Set `USE_MONGODB=true` in `server/.env`
2. **Restart the server**: `npm run dev`
3. **Login as admin** to the Configuration Manager
4. **Open Settings**: Click the "Settings" button in the header
5. **Configure connection**: Enter your MongoDB connection string
6. **Test connection**: Use the "Test Connection" button
7. **Migrate data**: Click "Migrate from SQLite" to transfer existing data

## Connection Strings Examples:

- **Local**: `mongodb://localhost:27017/config_manager`
- **Docker**: `mongodb://localhost:27017/config_manager`
- **Atlas**: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/config_manager`
- **Auth**: `mongodb://username:password@localhost:27017/config_manager`

## Verify Migration:
After migration, you should see your users and configurations in MongoDB. The system will use MongoDB for all new operations.
