const express = require("express");
const router = express.Router();
const DButils = require("./utils/DButils");

// Auth middleware
router.use((req, res, next) => {
  if (!req.session || !req.session.user_id) {
    return res.sendStatus(401);
  }
  next();
});

/**
 * GET /family
 * Fetch all family recipes created by the logged-in user
 */
router.get("/", async (req, res, next) => {
  try {
    const recipes = await DButils.execQuery(
      `SELECT * FROM family_recipes WHERE created_by = ?`,
      [req.session.user_id]
    );
    res.status(200).send(recipes);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /family/:recipeId
 * Fetch a specific family recipe
 */
router.get("/:recipeId", async (req, res, next) => {
  try {
    const result = await DButils.execQuery(
      `SELECT * FROM family_recipes WHERE family_recipe_id = ? AND created_by = ?`,
      [req.params.recipeId, req.session.user_id]
    );

    if (result.length === 0) {
      return res.status(404).send({ message: "Recipe not found" });
    }

    res.status(200).send(result[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /family
 * Add a new family recipe
 */
router.post("/", async (req, res, next) => {
  try {
    const {
      title,
      family_member,
      occasion,
      ingredients,
      instructions,
      images
    } = req.body;

    if (!title || !ingredients || !instructions) {
      return res.status(400).send({ message: "Missing required fields" });
    }

    await DButils.execQuery(
      `INSERT INTO family_recipes
       (title, family_member, occasion, ingredients, instructions, images, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        family_member || null,
        occasion || null,
        JSON.stringify(ingredients),
        instructions,
        JSON.stringify(images || []),
        req.session.user_id
      ]
    );

    res.status(201).send({ message: "Family recipe created successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /family/:recipeId
 * Update an existing family recipe
 */
router.put("/:recipeId", async (req, res, next) => {
  try {
    const {
      title,
      family_member,
      occasion,
      ingredients,
      instructions,
      images
    } = req.body;

    const result = await DButils.execQuery(
      `UPDATE family_recipes
       SET title = ?, family_member = ?, occasion = ?, ingredients = ?, instructions = ?, images = ?
       WHERE family_recipe_id = ? AND created_by = ?`,
      [
        title,
        family_member || null,
        occasion || null,
        JSON.stringify(ingredients),
        instructions,
        JSON.stringify(images || []),
        req.params.recipeId,
        req.session.user_id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).send({ message: "Recipe not found or not yours" });
    }

    res.status(200).send({ message: "Family recipe updated successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /family/:recipeId
 * Delete a family recipe
 */
router.delete("/:recipeId", async (req, res, next) => {
  try {
    const result = await DButils.execQuery(
      `DELETE FROM family_recipes WHERE family_recipe_id = ? AND created_by = ?`,
      [req.params.recipeId, req.session.user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).send({ message: "Recipe not found or not yours" });
    }

    res.status(200).send({ message: "Family recipe deleted successfully" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
