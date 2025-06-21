//#region imports and initial setup
require("dotenv").config();
const express = require("express");
const path = require("path");
const logger = require("morgan");
const session = require("client-sessions");
const DButils = require("./routes/utils/DButils");
const cors = require("cors");
const http = require("http");

const app = express();

// Disable ETag generation globally to prevent 304 responses for JSON APIs
app.set('etag', false);

// Disable caching for all API responses
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// ✅ FIX: CORS must be BEFORE sessions
const corsConfig = {
  origin: 'http://localhost:8080',   // your frontend dev server
  credentials: true,                // allow cookies across origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsConfig));
app.options("*", cors(corsConfig)); // handle preflight

// Logging and body parsers
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ✅ FIX: Session AFTER CORS + parsers
app.use(
  session({
    cookieName: "session",
    secret: "your-secret-key",             
    duration: 24 * 60 * 60 * 1000,         // 24h session
    activeDuration: 1000 * 60 * 5,        
    cookie: {
      httpOnly: true,                      
      secure: false,                      
      path: '/'
    }
  })
);

// Static file serving
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "../assignment-3-3-frontend/dist")));

// Serve index.html at root
app.get("/", function(req, res) {
  res.sendFile(path.join(__dirname, "../assignment-3-3-frontend/dist/index.html"));
});

//#region Routes
const user = require("./routes/user");
const recipes = require("./routes/recipes");
const auth = require("./routes/auth");
const family = require("./routes/family");
const meal_plan = require("./routes/meal_plan");
//#endregion

// ✅ Session middleware to attach user_id
app.use(function (req, res, next) {
  if (req.session && req.session.user_id) {
    DButils.execQuery("SELECT user_id FROM users")
      .then((users) => {
        if (users.find((x) => x.user_id === req.session.user_id)) {
          req.user_id = req.session.user_id;
        }
        next();
      })
      .catch((error) => next());
  } else {
    next();
  }
});

// API alive check
app.get("/api/alive", (req, res) => res.send("I'm alive"));

// API routes
app.use("/api/users", user);
app.use("/api/recipes", recipes);
app.use("/api/auth", auth);
app.use("/api/family", family);
app.use("/api/meal-plan", meal_plan);

// Error handler
app.use(function (err, req, res, next) {
  console.error(err);
  res.status(err.status || 500).send({ message: err.message, success: false });
});

// Start server
const port = process.env.PORT || 3000;
const server = http.createServer(app);
server.listen(port, () => {
  console.log(`✅ Server is running on http://localhost:${port}`);
});

// Graceful shutdown
process.on("SIGINT", function () {
  if (server) server.close(() => console.log("⛔ Server closed"));
  process.exit();
});

module.exports = app;
