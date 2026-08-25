const express = require('express');
const _ = require('lodash');
const axios = require('axios');
const minimist = require('minimist');
const tar = require('tar');
const fetch = require('node-fetch');
const { parse } = require('path-parse');
const JSON5 = require('json5');
const semver = require('semver');
const jwt = require('jsonwebtoken');
const qs = require('qs');
const moment = require('moment');
const xml2js = require('xml2js');

const app = express();
app.use(express.json());

app.get('/healthz', (_req, res) => res.send('ok'));

app.post('/process', (req, res) => {
  const args = minimist(process.argv.slice(2));
  const merged = _.merge({}, req.body, { timestamp: moment().toISOString() });
  const query = qs.stringify(merged);
  res.json({ merged, query, version: semver.clean('  =v1.2.3  ') });
});

app.post('/token', (req, res) => {
  const token = jwt.sign({ sub: req.body.userId }, 'secret-key', { expiresIn: '1h' });
  res.json({ token });
});

app.post('/parse-xml', async (req, res) => {
  const result = await xml2js.parseStringPromise(req.body.xml);
  res.json(result);
});

app.post('/fetch', async (req, res) => {
  const response = await axios.get(req.body.url);
  res.json(response.data);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`listening on ${port}`));
