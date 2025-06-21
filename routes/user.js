const express = require("express");
const router = express.Router();
const DButils = require("./utils/DButils");
const user_utils = require("./utils/user_utils");
const recipes_utils = require("./utils/recipes_utils");
const authMiddleware = require("./utils/auth_middleware");


// Middleware to require login
router.use((req, res, next) => {
  if (!req.session || !req.session.user_id) {
    return res.status(401).send({ message: "User not logged in" });
  }
  next();
});

/**
 * GET /users/profile
 * Returns the logged-in user's profile
 */
router.get("/profile", async (req, res, next) => {
  try {
    const result = await DButils.execQuery(
      "SELECT username, firstname, lastname, country, email, profile_pic FROM users WHERE user_id = ?",
      [req.session.user_id]
    );
    if (!result || result.length === 0) {
      return res.status(404).send({ message: "User not found" });
    }
    res.status(200).send(result[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /users/profile
 * Updates the user's profile information
 */
router.put("/profile", async (req, res, next) => {
  try {
    const { firstname, lastname, country, email, profile_pic } = req.body;

    await DButils.execQuery(
      `UPDATE users SET firstname=?, lastname=?, country=?, email=?, profile_pic=? WHERE user_id=?`,
      [firstname, lastname, country, email, profile_pic || null, req.session.user_id]
    );
    res.status(200).send({ message: "Profile updated successfully" });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /users/profile/favorites
 * Fetch favorite recipes for the logged-in user
 */
router.get("/profile/favorites", authMiddleware, async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    if (!user_id) {
      return res.status(401).send({ message: "User not logged in" });
    }
    // Use recipes_utils.getUserFavorites to get full recipe details
    const favorites = await recipes_utils.getUserFavorites(user_id);
    res.status(200).send(favorites);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /users/profile/favorites
 * Add recipe to favorites
 */
router.post("/profile/favorites", async (req, res, next) => {
  try {
    const { recipeId } = req.body;
    await DButils.execQuery(
      "INSERT INTO favorite_recipes (user_id, recipe_id) VALUES (?, ?)",
      [req.session.user_id, recipeId]
    );
    res.status(200).send({ message: "Recipe added to favorites" });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /users/profile/favorites
 * Remove recipe from favorites
 */
router.delete("/profile/favorites", async (req, res, next) => {
  try {
    const { recipeId } = req.body;
    await DButils.execQuery(
      "DELETE FROM favorite_recipes WHERE user_id = ? AND recipe_id = ?",
      [req.session.user_id, recipeId]
    );
    res.status(200).send({ message: "Recipe removed from favorites" });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /users/lastWatchedRecipes
 * Returns the last 3 watched recipes for the logged-in user
 */
router.get("/lastWatchedRecipes", async (req, res, next) => {
  try {
    const result = await DButils.execQuery(
      `SELECT recipe_id FROM last_watched_recipes
       WHERE user_id = ?
       ORDER BY viewed_at DESC
       LIMIT 3`,
      [req.session.user_id]
    );

    // Get full recipe details for each recipe ID
    const recipes = await Promise.all(
      result.map(async (row) => {
        try {
          // First try to get recipe from DB
          const recipeDetails = await recipes_utils.getRecipeInformation(row.recipe_id);
          return recipeDetails;
        } catch (error) {
          console.error(`Error fetching recipe ${row.recipe_id}:`, error);
          return null;
        }
      })
    );

    // Filter out any null values from failed fetches
    const validRecipes = recipes.filter(recipe => recipe !== null);
    res.status(200).send(validRecipes);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /users/lastWatchedRecipes
 * Adds a recipe to the last watched table
 */
router.post("/lastWatchedRecipes", authMiddleware, async (req, res, next) => {
  try {
    const { recipeId } = req.body;

    // First delete existing entry to update viewed_at
    await DButils.execQuery(
      "DELETE FROM last_watched_recipes WHERE user_id = ? AND recipe_id = ?",
      [req.session.user_id, recipeId]
    );

    await DButils.execQuery(
      "INSERT INTO last_watched_recipes (user_id, recipe_id) VALUES (?, ?)",
      [req.session.user_id, recipeId]
    );

    res.status(200).send({ message: "Recipe marked as watched" });
  } catch (err) {
    next(err);
  }
});

// prepare recipe 

router.post('/prepare-recipe/:recipeId', async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const recipe_id = req.params.recipeId;
    const { plan_id } = req.body;

    await user_utils.addPrepareRecipe(recipe_id, user_id, plan_id);

    res.status(201).send({ message: "Recipe added to preparation tracking" });
  } catch (error) {
    next(error);
  }
});

// in users.js or prepare.js
router.get("/prepare-recipe/:recipeId", async (req, res, next) => {
  try {
    const { plan_id } = req.query;
    const result = await user_utils.getRecipePreparation(
      req.params.recipeId,
      req.session.user_id,
      plan_id
    );
    res.status(200).send(result);
  } catch (error) {
    next(error);
  }
});


router.put('/prepare-recipe/:recipeId/preparation-step', async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const recipe_id = req.params.recipeId;
    const { step, plan_id } = req.body;

    if (typeof step !== 'number') {
      return res.status(400).send({ message: 'Invalid preparation step number' });
    }

    let query;
    let params;
    if (plan_id !== null && plan_id !== undefined) {
      query = `UPDATE recipe_progress SET current_preperation_step = ? WHERE user_id = ? AND recipe_id = ? AND plan_id = ?`;
      params = [step, user_id, recipe_id, plan_id];
    } else {
      query = `UPDATE recipe_progress SET current_preperation_step = ? WHERE user_id = ? AND recipe_id = ? AND plan_id IS NULL`;
      params = [step, user_id, recipe_id];
    }

    await DButils.execQuery(query, params);

    res.status(200).send({ message: 'Preparation step updated successfully' });
  } catch (error) {
    next(error);
  }
});

router.put('/prepare-recipe/:recipeId/ingredient-step', async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const recipe_id = req.params.recipeId;
    const { step, plan_id } = req.body;

    if (typeof step !== 'number') {
      return res.status(400).send({ message: 'Invalid ingredient step number' });
    }

    let query;
    let params;
    if (plan_id !== null && plan_id !== undefined) {
      query = `UPDATE recipe_progress SET current_ingredient_step = ? WHERE user_id = ? AND recipe_id = ? AND plan_id = ?`;
      params = [step, user_id, recipe_id, plan_id];
    } else {
      query = `UPDATE recipe_progress SET current_ingredient_step = ? WHERE user_id = ? AND recipe_id = ? AND plan_id IS NULL`;
      params = [step, user_id, recipe_id];
    }

    await DButils.execQuery(query, params);

    res.status(200).send({ message: 'Ingredient step updated successfully' });
  } catch (error) {
    next(error);
  }
});

router.put('/prepare-recipe/:recipeId/servings', async (req, res, next) => {
  try {
    const recipeId = req.params.recipeId;
    const { servings, plan_id } = req.body;
    const userId = req.session.user_id;

    if (!servings || servings <= 0) {
      return res.status(400).send({ message: "Invalid servings value" });
    }

    await user_utils.scaleRecipeServings(recipeId, userId, servings, plan_id);
    res.status(200).send({ message: "Servings scaled successfully" });
  } catch (error) {
    next(error);
  }
});


router.delete("/prepare-recipe/progress", async (req, res, next) => {
  try {
    await DButils.execQuery(
      `DELETE FROM recipe_progress WHERE user_id = ?`,
      [req.session.user_id]
    );
    res.status(200).send({ message: "Preparation data cleared" });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /users/{username}/family-recipes
 * Get user's family recipes
 */
router.get("/:username/family-recipes", authMiddleware, async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const requestedUsername = req.params.username;

    // Verify that the requested username matches the logged-in user's username
    const user = await DButils.execQuery("SELECT username FROM users WHERE user_id = ?", [user_id]);
    if (user.length === 0 || user[0].username !== requestedUsername) {
      return res.status(403).send({ message: "Forbidden: You can only access your own family recipes." });
    }

    const familyRecipes = await user_utils.getFamilyRecipes(user_id);
    res.status(200).send(familyRecipes);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
