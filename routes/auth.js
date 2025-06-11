const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const DButils = require("./utils/DButils");
const axios = require("axios");

// Register new user
router.post("/register", async (req, res, next) => {
    try {
      const {
        username,
        password,
        confirmPassword,
        firstname,
        lastname,
        country,
        email,
        profile_pic = null
      } = req.body;
  
      // Basic validation
      if (!username || !password || !confirmPassword || !firstname || !lastname || !country || !email) {
        return res.status(400).send({ message: "All fields are required" });
      }
  
      // Validate username: 3–8 letters
      if (!/^[A-Za-z]{3,8}$/.test(username)) {
        return res.status(400).send({ message: "Username must be 3–8 letters only" });
      }
  
      // Validate password: 5–10 characters, at least one number and special character
      if (
        password.length < 5 || password.length > 10 ||
        !/\d/.test(password) || !/[!@#$%^&*(),.?":{}|<>]/.test(password)
      ) {
        return res.status(400).send({ message: "Password must be 5–10 characters, include a number and a special character" });
      }
  
      // Confirm password match
      if (password !== confirmPassword) {
        return res.status(400).send({ message: "Passwords do not match" });
      }
  
      // Validate country via RESTCountries
      const countriesRes = await axios.get("https://restcountries.com/v3.1/all?fields=name");
      const validCountries = countriesRes.data.map(c => c.name.common);
      if (!validCountries.includes(country)) {
        return res.status(400).send({ message: "Invalid country" });
      }
  
      // Check if username already exists
      const existing = await DButils.execQuery(`SELECT 1 FROM users WHERE username = ?`, [username]);
      if (existing.length > 0) {
        return res.status(409).send({ message: "Username already exists" });
      }
  
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Insert into DB
      await DButils.execQuery(
        `INSERT INTO users (username, password, firstname, lastname, country, email, profile_pic)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [username, hashedPassword, firstname, lastname, country, email, profile_pic]
      );
  
      res.status(201).send({ message: "User registered successfully" });
    } catch (error) {
      console.error("Registration error:", error);
      next(error);
    }
  });
  

// Login
router.post("/login", async (req, res, next) => {
    try {
      const { username, password } = req.body;
  
      // Basic validation
      if (!username || !password) {
        return res.status(400).send({ message: "Username and password are required" });
      }
  
      // Secure query
      const users = await DButils.execQuery(
        `SELECT * FROM users WHERE username = ?`,
        [username]
      );
  
      if (users.length === 0) {
        return res.status(401).send({ message: "Username or password incorrect" });
      }
  
      const user = users[0];
  
      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).send({ message: "Username or password incorrect" });
      }
  
      // Set session
      req.session.user_id = user.user_id;
      req.session.username = user.username;
  
      res.status(200).send({ message: "Login successful", user_id: user.user_id });
    } catch (error) {
      console.error("Login error:", error);
      next(error);
    }
  });
  

// Logout
router.post("/logout", function (req, res) {
    req.session.reset();
    res.status(200).send({ message: "Logout successful" });
});

module.exports = router; 