const express = require("express");
const router = express.Router();
const recipes_utils = require("./utils/recipes_utils");
const authMiddleware = require("./utils/auth_middleware");

/**
 * GET /recipes
 * Get random recipes
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
 * GET /recipes/trending
 * Get trending recipes
 */
router.get("/trending", async (req, res, next) => {
  try {
    const recipes = await recipes_utils.getTrendingRecipes();
    res.send(recipes);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /recipes/popular
 * Get popular recipes
 */
router.get("/popular", async (req, res, next) => {
  try {
    const recipes = await recipes_utils.getPopularRecipes();
    res.send(recipes);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /recipes/search
 * Search recipes with filters
 */
router.get("/search", async (req, res, next) => {
  try {
    const { query, cuisine, diet, intolerance, limit = 5, sort, sortDirection } = req.query;
    
    // Validate query parameter
    if (!query || typeof query !== 'string' || query.trim() === '') {
      console.log('Backend: Empty search query received');
      return res.status(400).send({ message: 'Search query is required' });
    }

    console.log('Backend: Search request received with query:', query);
    const results = await recipes_utils.search(query, cuisine, diet, intolerance, limit, sort, sortDirection);
    res.send(results);
  } catch (error) {
    console.error('Backend: Search error:', error);
    next(error);
  }
});

/**
 * GET /recipes/my-recipes
 * Get user's own recipes (authenticated)
 */
router.get("/my-recipes", authMiddleware, async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    if (!user_id) {
      return res.status(401).send({ message: "User not logged in" });
    }

    const myRecipes = await recipes_utils.getUserRecipes(user_id);
    res.status(200).send(myRecipes);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /recipes/:recipeId
 * Get recipe details by ID
 */
router.get("/:recipeId", async (req, res, next) => {
  try {
    const recipe = await recipes_utils.getRecipeInformation(req.params.recipeId, req.params.user_id);
    res.status(200).send(recipe);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /recipes
 * Create a new recipe (authenticated)
 */
router.post("/", authMiddleware, async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    if (!user_id) {
      return res.status(401).send({ message: "User not logged in" });
    }

    const createdRecipe = await recipes_utils.addNewRecipe(req.body, user_id);
    res.status(201).send(createdRecipe);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /recipes/:recipeId/favorite
 * Add a recipe to favorites (authenticated)
 */
router.post("/:recipeId/favorite", authMiddleware, async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    if (!user_id) {
      return res.status(401).send({ message: "User not logged in" });
    }

    await recipes_utils.addToFavorites(user_id, req.params.recipeId);
    res.status(200).send({ message: "Recipe added to favorites" });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /recipes/:recipeId/favorite
 * Remove a recipe from favorites (authenticated)
 */
router.delete("/:recipeId/favorite", authMiddleware, async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    if (!user_id) {
      return res.status(401).send({ message: "User not logged in" });
    }

    await recipes_utils.removeFromFavorites(user_id, req.params.recipeId);
    res.status(200).send({ message: "Recipe removed from favorites" });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /recipes/favorites
 * Get user's favorite recipes (authenticated)
 */
router.get("/favorites", authMiddleware, async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    if (!user_id) {
      return res.status(401).send({ message: "User not logged in" });
    }

    const favorites = await recipes_utils.getUserFavorites(user_id);
    res.status(200).send(favorites);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
