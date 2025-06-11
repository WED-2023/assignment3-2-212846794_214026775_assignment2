//#region express configures
var express = require("express");
var path = require("path");
var logger = require("morgan");
const session = require("client-sessions");
const DButils = require("./routes/utils/DButils");
var cors = require('cors')

// Configuration
const SPOONACULAR_API_KEY = '9759fc27d4184dd3ae465ec8ef1a9fef';

// Debug: Check if API key is loaded
console.log('Spoonacular API Key:', SPOONACULAR_API_KEY ? 'Present' : 'Missing');

var app = express();
app.use(logger("dev")); //logger
app.use(express.json()); // parse application/json
app.use(
  session({
    cookieName: "session", // the cookie key name
    secret: "your-secret-key", // the encryption key
    duration: 24 * 60 * 60 * 1000, // expired after 24 hours
    activeDuration: 1000 * 60 * 5, // if expiresIn < activeDuration, the session will be extended by activeDuration milliseconds
    cookie: {
      httpOnly: false,
      secure: false // set to true in production with HTTPS
    }
  })
);
app.use(express.urlencoded({ extended: false })); // parse application/x-www-form-urlencoded
app.use(express.static(path.join(__dirname, "public"))); //To serve static files such as images, CSS files, and JavaScript files
//local:
// app.use(express.static(path.join(__dirname, "dist")));
//remote:
app.use(express.static(path.join(__dirname, '../assignment-3-3-frontend/dist')));

app.get("/",function(req,res)
{ 
  //remote: 
  res.sendFile(path.join(__dirname, '../assignment-3-3-frontend/dist/index.html'));
  //local:
  // res.sendFile(__dirname+"/index.html");

});

app.use(cors());
app.options("*", cors());

const corsConfig = {
  origin: true,
  credentials: true
};

app.use(cors(corsConfig));
app.options("*", cors(corsConfig));

//#endregion
const user = require("./routes/user");
const recipes = require("./routes/recipes");
const auth = require("./routes/auth");
const family = require("./routes/family");
const meal_plan = require("./routes/meal_plan");


//#region cookie middleware
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
//#endregion

// ----> For cheking that our server is alive
app.get("/api/alive", (req, res) => res.send("I'm alive"));

// Routings
app.use("/api/users", user);
app.use("/api/recipes", recipes);
app.use("/api/auth", auth);
app.use("/api/family", family);

app.use("/api/meal-plan", meal_plan);

// Default router
app.use(function (err, req, res, next) {
  console.error(err);
  res.status(err.status || 500).send({ message: err.message, success: false });
});

module.exports = app;