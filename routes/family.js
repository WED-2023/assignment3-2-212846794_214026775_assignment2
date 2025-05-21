var express = require("express");
var router = express.Router();
const DButils = require("./utils/DButils");

// Authentication middleware
router.use(async function (req, res, next) {
  if (req.session && req.session.user_id) {
    DButils.execQuery("SELECT user_id FROM users").then((users) => {
      if (users.find((x) => x.user_id === req.session.user_id)) {
        req.user_id = req.session.user_id;
        next();
      }
    }).catch(err => next(err));
  } else {
    res.sendStatus(401);
  }
});

// Get all family recipes for the logged-in user
router.get("/", async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const recipes = await DButils.execQuery(
      `SELECT * FROM family_recipes WHERE created_by = ${user_id}`
    );
    res.status(200).send(recipes);
  } catch (error) {
    next(error);
  }
});

// Get a specific family recipe
router.get("/:recipeId", async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const recipe_id = req.params.recipeId;
    const recipes = await DButils.execQuery(
      `SELECT * FROM family_recipes WHERE family_recipe_id = ${recipe_id} AND created_by = ${user_id}`
    );
    
    if (recipes.length === 0) {
      throw { status: 404, message: "Recipe not found" };
    }
    
    res.status(200).send(recipes[0]);
  } catch (error) {
    next(error);
  }
});

// Add a new family recipe
router.post("/", async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const { title, family_member, occasion, ingredients, instructions, images } = req.body;
    
    // Validate required fields
    if (!title || !ingredients || !instructions) {
      throw { status: 400, message: "Missing required fields" };
    }

    await DButils.execQuery(
      `INSERT INTO family_recipes (title, family_member, occasion, ingredients, instructions, images, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, family_member, occasion, JSON.stringify(ingredients), instructions, JSON.stringify(images), user_id]
    );

    res.status(201).send({ message: "Family recipe created successfully" });
  } catch (error) {
    next(error);
  }
});

// Update a family recipe
router.put("/:recipeId", async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const recipe_id = req.params.recipeId;
    const { title, family_member, occasion, ingredients, instructions, images } = req.body;

    // Check if recipe exists and belongs to user
    const exists = await DButils.execQuery(
      `SELECT * FROM family_recipes WHERE family_recipe_id = ${recipe_id} AND created_by = ${user_id}`
    );

    if (exists.length === 0) {
      throw { status: 404, message: "Recipe not found" };
    }

    await DButils.execQuery(
      `UPDATE family_recipes 
       SET title = ?, family_member = ?, occasion = ?, ingredients = ?, instructions = ?, images = ?
       WHERE family_recipe_id = ? AND created_by = ?`,
      [title, family_member, occasion, JSON.stringify(ingredients), instructions, JSON.stringify(images), recipe_id, user_id]
    );

    res.status(200).send({ message: "Family recipe updated successfully" });
  } catch (error) {
    next(error);
  }
});

// Delete a family recipe
router.delete("/:recipeId", async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const recipe_id = req.params.recipeId;

    const result = await DButils.execQuery(
      `DELETE FROM family_recipes WHERE family_recipe_id = ${recipe_id} AND created_by = ${user_id}`
    );

    if (result.affectedRows === 0) {
      throw { status: 404, message: "Recipe not found" };
    }

    res.status(200).send({ message: "Family recipe deleted successfully" });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 