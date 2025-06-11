const express = require("express");
const router = express.Router();
const DButils = require("./utils/DButils");

router.use((req, res, next) => {
  if (!req.session || !req.session.user_id) return res.sendStatus(401);
  next();
});

// Create a new meal plan
router.post("/plans", async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).send({ message: "Name is required" });

    const result = await DButils.execQuery(
      `INSERT INTO meal_plans (user_id, name) VALUES (?, ?)`,
      [req.session.user_id, name]
    );

    res.status(201).send({ message: "Meal plan created", plan_id: result.insertId });
  } catch (error) {
    next(error);
  }
});

// Get all user's meal plans
router.get("/plans", async (req, res, next) => {
  try {
    const plans = await DButils.execQuery(
      `SELECT * FROM meal_plans WHERE user_id = ?`,
      [req.session.user_id]
    );
    res.status(200).send(plans);
  } catch (error) {
    next(error);
  }
});

// Get all recipes in a specific meal plan
router.get("/plans/:planId", async (req, res, next) => {
  try {
    const rows = await DButils.execQuery(
      `SELECT * FROM meal_plan_recipes WHERE plan_id = ?`,
      [req.params.planId]
    );
    res.status(200).send(rows);
  } catch (error) {
    next(error);
  }
});

// Add recipe to a meal plan
router.post("/plans/:planId", async (req, res, next) => {
  try {
    const { recipe_id, day_of_week, meal_type } = req.body;
    if (!recipe_id || !day_of_week || !meal_type)
      return res.status(400).send({ message: "Missing required fields" });

    await DButils.execQuery(
      `INSERT INTO meal_plan_recipes (plan_id, recipe_id, day_of_week, meal_type)
       VALUES (?, ?, ?, ?)`,
      [req.params.planId, recipe_id, day_of_week, meal_type]
    );

    res.status(201).send({ message: "Recipe added to meal plan" });
  } catch (error) {
    next(error);
  }
});

// Remove a recipe from a meal plan
router.delete("/plans/:planId/:recipeId", async (req, res, next) => {
  try {
    await DButils.execQuery(
      `DELETE FROM meal_plan_recipes WHERE plan_id = ? AND recipe_id = ?`,
      [req.params.planId, req.params.recipeId]
    );
    res.status(200).send({ message: "Recipe removed from meal plan" });
  } catch (error) {
    next(error);
  }
});

// Update progress of a recipe
router.put("/plans/:planId/:recipeId/progress", async (req, res, next) => {
  try {
    const { progress } = req.body;
    const allowed = ["Not Started", "In Progress", "Completed"];
    if (!allowed.includes(progress))
      return res.status(400).send({ message: "Invalid progress value" });

    await DButils.execQuery(
      `UPDATE meal_plan_recipes SET progress = ? WHERE plan_id = ? AND recipe_id = ?`,
      [progress, req.params.planId, req.params.recipeId]
    );
    res.status(200).send({ message: "Progress updated" });
  } catch (error) {
    next(error);
  }
});

// Bulk update meal types and days for a specific meal plan
router.put("/plans/:planId/order", async (req, res, next) => {
  try {
    const updates = req.body.updates;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).send({ message: "Updates array is required" });
    }

    for (const { recipe_id, day_of_week, meal_type } of updates) {
      if (!recipe_id || !day_of_week || !meal_type) continue;

      await DButils.execQuery(
        `UPDATE meal_plan_recipes SET day_of_week = ?, meal_type = ?
         WHERE plan_id = ? AND recipe_id = ?`,
        [day_of_week, meal_type, req.params.planId, recipe_id]
      );
    }

    res.status(200).send({ message: "Meal plan updated successfully" });
  } catch (error) {
    next(error);
  }
});


module.exports = router;
