var express = require("express");
var router = express.Router();
const MySql = require("../routes/utils/MySql");
const DButils = require("../routes/utils/DButils");
const bcrypt = require("bcrypt");

router.post("/Register", async (req, res, next) => {
  try {
    console.log('Registration attempt for username:', req.body.username);
    
    // parameters exists
    // valid parameters
    // username exists
    let user_details = {
      username: req.body.username,
      first_name: req.body.firstName,
      last_name: req.body.lastName,
      country: req.body.country,
      password: req.body.password,
      email: req.body.email
    }

    console.log('User details:', {
      username: user_details.username,
      has_password: !!user_details.password,
      email: user_details.email
    });

    let users = [];
    users = await DButils.execQuery("SELECT username from users");

    if (users.find((x) => x.username === user_details.username))
      throw { status: 409, message: "Username taken" };

    // add the new username
    const saltRounds = 10; 
    console.log('Using salt rounds:', saltRounds);
    
    let hash_password = bcrypt.hashSync(
      user_details.password,
      saltRounds
    );

    console.log('Generated password hash:', !!hash_password);

    const query = `
      INSERT INTO users (
        username, 
        first_name, 
        last_name, 
        country, 
        password_hash, 
        email
      ) VALUES (
        '${user_details.username}', 
        '${user_details.first_name}', 
        '${user_details.last_name}',
        '${user_details.country}', 
        '${hash_password}', 
        '${user_details.email}'
      )
    `;

    console.log('Executing query:', query);
    await DButils.execQuery(query);

    console.log('User registered successfully');
    res.status(201).send({ message: "user created", success: true });
  } catch (error) {
    console.error('Registration error:', error);
    next(error);
  }
});

router.post("/Login", async (req, res, next) => {
  try {
    console.log('Login attempt for username:', req.body.username);
    
    // check that username exists
    const users = await DButils.execQuery("SELECT username FROM users");
    if (!users.find((x) => x.username === req.body.username))
      throw { status: 401, message: "Username or Password incorrect" };

    // check that the password is correct
    const query = `SELECT user_id, username, password_hash FROM users WHERE username = '${req.body.username}'`;
    console.log('Executing query:', query);
    
    const result = await DButils.execQuery(query);
    console.log('Query result:', JSON.stringify(result, null, 2));
    
    const user = result[0];
    console.log('User object:', JSON.stringify(user, null, 2));

    if (!req.body.password) {
      throw { status: 400, message: "Password is required" };
    }

    if (!user || !user.password_hash) {
      console.error('User or password hash missing:', { user });
      throw { status: 500, message: "User password hash not found" };
    }

    // Log the exact values being passed to bcrypt
    console.log('Bcrypt comparison values:', {
      providedPassword: req.body.password,
      storedHash: user.password_hash,
      passwordType: typeof req.body.password,
      hashType: typeof user.password_hash
    });

    try {
      // Ensure both values are strings
      const providedPassword = String(req.body.password);
      const storedHash = String(user.password_hash);

      console.log('About to compare:', {
        providedPassword,
        storedHash
      });

      const passwordMatch = bcrypt.compareSync(providedPassword, storedHash);
      console.log('Password match result:', passwordMatch);

      if (!passwordMatch) {
        throw { status: 401, message: "Username or Password incorrect" };
      }

      // Set cookie
      req.session.user_id = user.user_id;
      console.log("session user_id login: " + req.session.user_id);

      // return cookie
      res.status(200).send({ message: "login succeeded", success: true });
    } catch (bcryptError) {
      console.error('Bcrypt error:', bcryptError);
      throw { status: 500, message: "Error comparing passwords" };
    }
  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
});

router.post("/Logout", function (req, res) {
  console.log("session user_id Logout: " + req.session.user_id);
  req.session.reset(); // reset the session info --> send cookie when  req.session == undefined!!
  res.send({ success: true, message: "logout succeeded" });
});

module.exports = router;