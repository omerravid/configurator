// Dynamic model loader based on database type (MongoDB by default)
const useMongoDB = process.env.USE_MONGODB !== 'false';

let User, Configuration;

if (useMongoDB) {
  console.log('Using MongoDB models');
  User = require('./User.mongo');
  Configuration = require('./Configuration.mongo');
} else {
  console.log('SQLite support has been removed. Please use MongoDB.');
  console.error('Cannot start application without MongoDB. Exiting...');
  process.exit(1);
}

module.exports = {
  User,
  Configuration,
  useMongoDB
};
