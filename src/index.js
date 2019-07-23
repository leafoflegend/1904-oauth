const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const ejs = require('ejs');
const chalk = require('chalk');
const session = require('express-session');
const axios = require('axios');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const { db, models } = require('./db/index.js');

const { User } = models;

if (process.env.NODE_ENV === 'development') {
  dotenv.config();
}

const PORT = process.env.PORT || 3000;
const publicPath = path.join(__dirname, '../public');

const app = express();

app.use(express.static(publicPath));

app.engine('ejs', ejs.renderFile);

app.use(express.static(publicPath));
app.use(session({
  secret: process.env.SESSION_SECRET || 'not a good secret',
  maxAge: 24 * 60 * 60 * 1000,
  resave: false,
  saveUninitialized: false,
  name: 'SID',
  store: new SequelizeStore({
    db,
    table: 'session',
    extendDefaultFields: (defaults, session) => ({
      data: defaults.data,
      expires: defaults.expires,
      userId: session.userId
    }),
  }),
}));

app.get('/', async (req, res) => {
  if (req.session.userId) {
    const githubAPIUrl = 'https://api.github.com/user';

    let user = await User
      .findByPk(req.session.userId);

    if (!user) throw new Error('Invalid Session userId');

    const { githubAccessToken } = user;

    const rawGithubData = await axios.get(githubAPIUrl, {
      headers: {
        authorization: `token ${githubAccessToken}`,
      },
    });

    const { data: githubData } = rawGithubData;

    if (!user.name) {
      user = await user.update({
        name: githubData.login,
      });
    }

    res.render(path.join(publicPath, './index.ejs'), { user: {
        name: user.name,
        data: githubData,
      }
    });
  } else {
    res.render(path.join(publicPath, './index.ejs'), { user: {} });
  }
});

app.get('/logout', async (req, res) => {
  if (!req.session.userId) {
    res.redirect('/');
  } else {
    try {
      const user = await User.findByPk(req.session.userId);

      await user.destroy();

      const destroySession = new Promise((res, rej) => {
        req.session.destroy((err) => {
          if (err) rej(err);
          else res();
        });
      });

      await destroySession;

      console.log(chalk.greenBright('User successfully logged out.'));

      res.redirect('/');
    } catch (e) {
      console.log(chalk.redBright('Error logging user out.'), e);
      res.status(500).send(e);
    }
  }
});

app.get('/login', (req, res) => {
  if (!req.session.userId) {

    const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GH_CLIENT_ID}`;

    res.redirect(redirectUrl);
  } else {
    res.redirect('/');
  }
});

app.get('/github', async (req, res) => {
  let code = '';

  try {
    code = req.query.code;
    if (!code) throw new Error('No GitHub code passed.');
  } catch (e) {
    console.log(chalk.redBright('Error getting GitHub code.'), e);
    res.status(400).send(e);
  }

  try {
    const githubUrl = `https://github.com/login/oauth/access_token`;

    const {data: githubResponse} = await axios
      .post(githubUrl, {
        client_id: process.env.GH_CLIENT_ID,
        client_secret: process.env.GH_CLIENT_SECRET,
        code,
      }, {
        headers: {
          Accept: 'application/json'
        }
      });

    if (typeof githubResponse !== 'object' || !githubResponse.access_token) {
      throw new Error(`Bad response from GitHub. ${JSON.stringify(githubResponse)}`);
    }

    const user = await User.create({
      githubAccessToken: githubResponse.access_token,
    });

    req.session.userId = user.id;
    console.log(chalk.greenBright('Successfully authenticated with GitHub.'));
    res.redirect('/');
  } catch (e) {
    console.log(chalk.redBright('Error authenticating with GitHub.'), e);
    res.status(500).send(e);
  }
});


const appListen = () => new Promise((res) => {
  app.listen(PORT, () => {
    console.log(chalk.greenBright(`Express successfully started on port ${PORT}`));
    res();
  });
});

db.sync()
  .then(() => {
    console.log(chalk.greenBright('Database successfully synced.'));
    return appListen();
  })
  .then(() => {
    console.log(chalk.greenBright('Application started.'));
  })
  .catch((e) => {
    console.log(chalk.redBright('Application failed to start.'), e);
  });


