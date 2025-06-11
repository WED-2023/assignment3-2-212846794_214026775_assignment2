var express = require("express");
var router = express.Router();
const DButils = require("./utils/DButils");
const user_utils = require("./utils/user_utils");
const recipe_utils = require("./utils/recipes_utils");

// Authentication middleware
router.use(async function (req, res, next) {
  console.log('Auth middleware - Session data:', req.session);
  if (req.session && req.session.user_id) {
    try {
      const users = await DButils.execQuery("SELECT user_id FROM users");
      console.log('Available users:', users);
      console.log('Looking for user_id:', req.session.user_id);
      if (users.find((x) => x.user_id === req.session.user_id)) {
        req.user_id = req.session.user_id;
        console.log('User authenticated:', req.user_id);
        next();
      } else {
        console.log('User not found in database');
        res.status(401).send({ message: "User not found", success: false });
      }
    } catch (error) {
      console.error('Auth middleware error:', error);
      next(error);
    }
  } else {
    console.log('No session or user_id in session');
    res.status(401).send({ message: "Not authenticated", success: false });
  }
});

// Get user's recipes
router.get('/:username/recipes', async (req, res, next) => {
  try {
    const username = req.params.username;
    const recipes = await user_utils.getUserRecipes(username);
    res.status(200).send(recipes);
  } catch (error) {
    next(error);
  }
});

// Get user's favorites
router.get('/:username/favorites', async (req, res, next) => {
  try {
    const username = req.params.username;
    console.log('Getting favorites for username:', username);
    
    const user = await DButils.execQuery(
      `SELECT user_id FROM users WHERE username = '${username}'`
    );
    
    if (user.length === 0) {
      console.log('User not found:', username);
      throw { status: 404, message: "User not found" };
    }

    const user_id = user[0].user_id;
    console.log('Found user_id:', user_id);
    
    const favorites = await user_utils.getFavoriteRecipes(user_id);
    console.log('Found favorites:', favorites);
    
    if (!favorites || favorites.length === 0) {
      console.log('No favorite recipes found for user:', username);
      return res.status(200).send([]);
    }
    
    res.status(200).send(favorites);
  } catch (error) {
    console.error('Error in GET /:username/favorites:', error);
    next(error);
  }
});

// Add recipe to favorites
router.post('/:username/favorites', async (req, res, next) => {
  try {
    const username = req.params.username;
    const user = await DButils.execQuery(
      `SELECT user_id FROM users WHERE username = '${username}'`
    );
    
    if (user.length === 0) {
      throw { status: 404, message: "User not found" };
    }

    const user_id = user[0].user_id;
    const recipe_id = req.body.recipeId;
    
    await user_utils.markAsFavorite(user_id, recipe_id);
    res.status(200).send({ message: "Recipe successfully saved as favorite" });
  } catch (error) {
    next(error);
  }
});

// Get last watched recipes
router.get("/lastWatchedRecipes", async (req, res, next) => {
  try {
    console.log('Last watched recipes endpoint - Full request:', {
      session: req.session,
      user_id: req.session.user_id,
      headers: req.headers
    });
    
    const user_id = req.session.user_id;
    if (!user_id) {
      console.log('No user_id in session');
      return res.status(401).send({ message: "Not authenticated" });
    }
    
    const lastWatched = await user_utils.getLastWatchedRecipes(user_id);
    console.log('Last watched recipes:', lastWatched);
    
    if (!lastWatched || lastWatched.length === 0) {
      console.log('No recipes found in last_watched_recipes table');
      return res.status(200).send([]);
    }
    
    res.status(200).send(lastWatched);
  } catch (error) {
    console.error('Error in lastWatchedRecipes endpoint:', error);
    next(error);
  }
});

// Mark recipe as watched
router.post('/lastWatchedRecipes', async (req, res, next) => {
  try {
    console.log('Marking recipe as watched - Session:', req.session);
    const user_id = req.session.user_id;
    if (!user_id) {
      console.log('No user_id in session');
      return res.status(401).send({ message: "Not authenticated" });
    }
    const recipe_id = req.body.recipeId;
    console.log('Marking recipe as watched:', { user_id, recipe_id });
    await DButils.execQuery(`
      DELETE FROM last_watched_recipes WHERE user_id = ${user_id} AND recipe_id = ${recipe_id}
    `);
    await DButils.execQuery(`
      INSERT INTO last_watched_recipes (user_id, recipe_id, viewed_at)
      VALUES (${user_id}, ${recipe_id}, CURRENT_TIMESTAMP)
    `);
    res.status(200).send({ message: "Recipe successfully marked as watched" });
  } catch (error) {
    console.error('Error marking recipe as watched:', error);
    next(error);
  }
});

// Get family recipes
router.get('/:username/family-recipes', async (req, res, next) => {
  try {
    const username = req.params.username;
    const user = await DButils.execQuery(
      `SELECT user_id FROM users WHERE username = '${username}'`
    );
    
    if (user.length === 0) {
      throw { status: 404, message: "User not found" };
    }

    const user_id = user[0].user_id;
    const recipes = await user_utils.getMyFamilyRecipes(user_id);
    res.status(200).send(recipes);
  } catch (error) {
    next(error);
  }
});

// Add family recipe
router.post('/:username/family-recipes', async (req, res, next) => {
  try {
    const username = req.params.username;
    const user = await DButils.execQuery(
      `SELECT user_id FROM users WHERE username = '${username}'`
    );
    
    if (user.length === 0) {
      throw { status: 404, message: "User not found" };
    }

    const user_id = user[0].user_id;
    const {
      title,
      owner,
      whenToPrepare,
      readyInMinutes,
      vegetarian,
      vegan,
      glutenFree,
      image,
      instructions,
      ingredients
    } = req.body;

    // Generate a unique recipe ID
    const recipe_id = Date.now();

    await user_utils.markAsFamilyRecipe(
      recipe_id,
      user_id,
      owner,
      whenToPrepare,
      title,
      readyInMinutes,
      vegetarian,
      vegan,
      glutenFree,
      image,
      instructions,
      ingredients
    );

    res.status(201).send({ message: "Family recipe successfully added" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
