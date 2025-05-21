var express = require("express");
var router = express.Router();
const recipes_utils = require("./utils/recipes_utils");

/**
 * Get random recipes
 * GET /api/recipes
 */
router.get("/", async (req, res, next) => {
  try {
    const recipes = await recipes_utils.getRandomRecipes();
    res.send(recipes);
  } catch (error) {
    next(error);
  }
});

/**
 * Search recipes with filters
 * GET /api/recipes/search
 */
router.get("/search", async (req, res, next) => {
  try {
    const { query, cuisine, diet, intolerance, limit = 5 } = req.query;
    const recipes = await recipes_utils.search(query, cuisine, diet, intolerance, limit);
    res.send(recipes);
  } catch (error) {
    next(error);
  }
});

/**
 * Get recipe details by ID
 * GET /api/recipes/{id}
 */
router.get("/:recipeId", async (req, res, next) => {
  //done and checked
  try {
    const recipe = await recipes_utils.getRecipeDetails(req.params.recipeId);
    res.send(recipe);
  } catch (error) {
    next(error);
  }
});

/**
 * Create new recipe
 * POST /api/recipes
 */
router.post("/", async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    if (!user_id) {
      throw { status: 401, message: "Please Login to add new recipe." };
    }
    const recipe_id = await recipes_utils.addNewRecipe(req);
    res.status(201).send({ id: recipe_id, message: "Recipe was added successfully!" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
