// Dynamic model loader based on database type (MongoDB by default)
const useMongoDB = process.env.USE_MONGODB !== 'false';

let User, Configuration;

if (useMongoDB) {
  console.log('Using MongoDB models');
  User = require('./User.mongo');
  Configuration = require('./Configuration.mongo');
} else {
  console.log('Using SQLite models');
  User = require('./User');
  Configuration = require('./Configuration');
}

module.exports = {
  User,
  Configuration,
  useMongoDB
};
