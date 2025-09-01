// Dynamic model loader based on database type
const useMongoDB = process.env.USE_MONGODB === 'true';

let User, Configuration, Rule;

if (useMongoDB) {
  console.log('Using MongoDB models');
  User = require('./User.mongo');
  Configuration = require('./Configuration.mongo');
  Rule = require('./Rule.mongo');
} else {
  console.log('Using SQLite models');
  User = require('./User');
  Configuration = require('./Configuration');
  Rule = require('./Rule');
}

module.exports = {
  User,
  Configuration,
  Rule,
  useMongoDB
};
