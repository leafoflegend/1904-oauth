const { STRING } = require('sequelize');
const db = require('../connection.js');

const User = db.define('user', {
  githubAccessToken: {
    type: STRING,
    allowNull: false,
  },
  name: {
    type: STRING,
  },
});

module.exports = User;
