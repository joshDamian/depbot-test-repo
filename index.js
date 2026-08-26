const express = require("express");
const _ = require("lodash");
const axios = require("axios");
const minimist = require("minimist");
const tar = require("tar");
const fetch = require("node-fetch");
const { parse } = require("path-parse");
const JSON5 = require("json5");
const semver = require("semver");
const jwt = require("jsonwebtoken");
const qs = require("qs");
const moment = require("moment");
const xml2js = require("xml2js");
const postcss = require("postcss");
const ToughCookie = require("tough-cookie");

const app = express();
app.use(express.json());

app.get("/healthz", (_req, res) => res.send("ok"));

app.post("/process", (req, res) => {
  const args = minimist(process.argv.slice(2));
  const merged = _.merge({}, req.body, { timestamp: moment().toISOString() });
  // qs.stringify with allowPrototypes — removed in qs >= 6.10
  const query = qs.stringify(merged, { allowPrototypes: true });
  res.json({ merged, query, version: semver.clean("  =v1.2.3  ") });
});

app.post("/token", (req, res) => {
  const token = jwt.sign({ sub: req.body.userId }, "secret-key", { expiresIn: "1h" });
  res.json({ token });
});

app.get("/verify", (req, res) => {
  // jwt.verify without callback — synchronous usage removed in jsonwebtoken v9
  try {
    const decoded = jwt.verify(req.headers.authorization, "secret-key");
    res.json({ decoded });
  } catch (err) {
    res.status(401).json({ error: "invalid token" });
  }
});

app.post("/parse-xml", async (req, res) => {
  const result = await xml2js.parseStringPromise(req.body.xml);
  res.json(result);
});

app.post("/extract", async (req, res) => {
  // tar.Extract class — renamed/removed in tar >= 6
  const extractor = new tar.Extract({ path: "/tmp/extract" });
  res.json({ started: true });
});

app.post("/style", async (req, res) => {
  // postcss sync .process() without `from` — errors in postcss v8+
  const result = postcss().process(req.body.css);
  res.json({ css: result.css });
});

app.post("/cookie", (req, res) => {
  // tough-cookie Cookie.parse with loose mode — removed in v4+
  const cookie = ToughCookie.Cookie.parse(req.headers.cookie, { loose: true });
  res.json({ cookie: cookie ? cookie.toJSON() : null });
});

app.post("/fetch", async (req, res) => {
  const response = await axios.get(req.body.url);
  res.json(response.data);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`listening on ${port}`));

