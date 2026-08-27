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
  const query = qs.stringify(merged);
  res.json({ merged, query, version: semver.clean("  =v1.2.3  ") });
});

// axios: uses CancelToken API — removed in axios 1.x, replaced by AbortController
const pendingRequests = new Map();

app.post("/fetch", async (req, res) => {
  const source = axios.CancelToken.source();
  pendingRequests.set(req.body.requestId, source);

  setTimeout(() => source.cancel("Request timed out"), 5000);

  try {
    const response = await axios.get(req.body.url, {
      cancelToken: source.token,
    });
    res.json(response.data);
  } catch (err) {
    if (axios.isCancel(err)) {
      res.status(408).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message });
    }
  } finally {
    pendingRequests.delete(req.body.requestId);
  }
});

app.delete("/fetch/:requestId", (req, res) => {
  const source = pendingRequests.get(req.params.requestId);
  if (source) {
    source.cancel("Cancelled by user");
    pendingRequests.delete(req.params.requestId);
  }
  res.json({ cancelled: true });
});

// jsonwebtoken: uses algorithms list including 'none' — rejected in v9
app.post("/token", (req, res) => {
  const token = jwt.sign({ sub: req.body.userId }, "secret-key", {
    algorithm: "HS256",
    expiresIn: "1h",
  });
  res.json({ token });
});

app.get("/verify", (req, res) => {
  try {
    // TODO(depbot-triage): jsonwebtoken 8.5.1 → 9.0.0 — review usage below
    const decoded = jwt.verify(req.headers.authorization, "secret-key", {
      algorithms: ["HS256", "none"],
    });
    res.json({ decoded });
  } catch (err) {
    res.status(401).json({ error: "invalid token" });
  }
});

// postcss: synchronous .process().css access — throws in postcss v8
app.post("/style", (req, res) => {
  const processed = postcss().process(req.body.css).css;
  res.json({ css: processed });
});

app.post("/lint", (req, res) => {
  const root = postcss.parse(req.body.css);
  root.walkDecls((decl) => {
    if (decl.prop === "color" && decl.value === "red") {
      decl.value = "#ff0000";
    }
  });
  const output = root.toResult().css;
  res.json({ css: output });
});

// tar: uses tar.Extract class — does not exist in tar v6+
app.post("/extract", async (req, res) => {
  const extractor = new tar.Extract({ path: "/tmp/extract" });
  extractor.on("end", () => res.json({ done: true }));
  req.pipe(extractor);
});

app.post("/pack", async (req, res) => {
  const pack = new tar.Pack({ gzip: true });
  pack.pipe(res);
  pack.add("file.txt");
  pack.end();
});

// tough-cookie: uses CookieJar with loose parsing — changed in v4
app.post("/cookie", (req, res) => {
  const jar = new ToughCookie.CookieJar();
  const cookie = ToughCookie.Cookie.parse(req.headers.cookie, { loose: true });
  if (cookie) {
    jar.setCookieSync(cookie, "http://example.com");
  }
  const cookies = jar.getCookiesSync("http://example.com");
  res.json({ cookies: cookies.map((c) => c.toJSON()) });
});

// xml2js: uses parseString callback pattern
app.post("/parse-xml", (req, res) => {
  const parser = new xml2js.Parser({
    explicitArray: false,
    normalizeTags: true,
  });
  parser.parseString(req.body.xml, (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json(result);
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`listening on ${port}`));
