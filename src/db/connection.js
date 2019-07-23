const Sequelize = require('sequelize');

const connection = new Sequelize(process.env.DATABASE_URI || 'postgres://localhost:5432/oauth-example', {
  logging: false,
});

module.exports = connection;
