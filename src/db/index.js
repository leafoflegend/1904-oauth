const db = require('./connection.js');
const { User } = require('./models/index.js');

module.exports = {
  models: {
    User,
  },
  db,
};
