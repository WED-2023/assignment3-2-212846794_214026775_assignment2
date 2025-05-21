var express = require("express");
var router = express.Router();
const DButils = require("./utils/DButils");
const user_utils = require("./utils/user_utils");

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

/**
 * Get user's meal plan
 * GET /api/meal-plan
 */
router.get("/", async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const mealPlan = await user_utils.getMealPlan(user_id);
    res.status(200).send(mealPlan);
  } catch (error) {
    next(error);
  }
});

/**
 * Add recipe to meal plan
 * POST /api/meal-plan
 */
router.post("/", async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const { recipeId, position } = req.body;
    await user_utils.addToMealPlan(user_id, recipeId, position);
    res.status(200).send("Recipe added to meal plan");
  } catch (error) {
    next(error);
  }
});

/**
 * Remove recipe from meal plan
 * DELETE /api/meal-plan/{recipeId}
 */
router.delete("/:recipeId", async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const recipeId = req.params.recipeId;
    await user_utils.removeFromMealPlan(user_id, recipeId);
    res.status(200).send("Recipe removed from meal plan");
  } catch (error) {
    next(error);
  }
});

module.exports = router; 