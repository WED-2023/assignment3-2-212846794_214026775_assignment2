const express = require("express");
const router = express.Router();
const DButils = require("./utils/DButils");
const axios = require("axios");

router.use((req, res, next) => {
  if (!req.session || !req.session.user_id) return res.sendStatus(401);
  next();
});

// Get user's meal plans
router.get("/", async (req, res, next) => {
  try {
    console.log("Fetching meal plans for user:", req.session.user_id);
    
    // Get all meal plans for the user
    let plansData = await DButils.execQuery(
      `SELECT * FROM meal_plans WHERE user_id = ?`,
      [req.session.user_id]
    );
    const plans = Array.isArray(plansData) ? plansData : [plansData].filter(Boolean);

    console.log("Raw plans from DB:", plans);

    // For each plan, get its recipes with details
    const plansWithRecipes = await Promise.all(
      plans.map(async (plan) => {
        // Get recipes for this plan
        let recipesData = await DButils.execQuery(
          `SELECT mpr.*, r.title, r.image, r.readyInMinutes, r.servings,
                  rp.current_ingredient_step, rp.current_preperation_step
           FROM meal_plan_recipes mpr 
           LEFT JOIN recipes r ON mpr.recipe_id = r.recipe_id 
           LEFT JOIN recipe_progress rp ON mpr.recipe_id = rp.recipe_id AND mpr.plan_id = rp.plan_id
           WHERE mpr.plan_id = ? 
           ORDER BY mpr.recipe_order`,
          [plan.plan_id]
        );
        console.log(`Raw recipesData for plan ${plan.plan_id}:`, recipesData);
        const recipes = Array.isArray(recipesData) ? recipesData : [recipesData].filter(Boolean);
        console.log(`Processed recipes array for plan ${plan.plan_id}:`, recipes);

        // For each recipe, get additional details from Spoonacular if needed
        const recipesWithDetails = await Promise.all(
          recipes.filter(Boolean).map(async (recipe) => {
            // If we have all the details from the database, return them
            if (recipe.title && recipe.image && recipe.readyInMinutes && recipe.servings) {
              return {
                ...recipe,
                total_ingredients: recipe.extendedIngredients?.length || 0,
                total_steps: recipe.instructions?.length || 0
              };
            }

            // Otherwise, fetch from Spoonacular
            try {
              const spoonacularData = await axios.get(
                `https://api.spoonacular.com/recipes/${recipe.recipe_id}/information`,
                {
                  params: {
                    apiKey: process.env.SPOONACULAR_API_KEY,
                    includeNutrition: false
                  }
                }
              );

              // Get ingredients and instructions
              const ingredients = spoonacularData.data.extendedIngredients.map(ing => ing.original);
              const instructions = spoonacularData.data.analyzedInstructions[0]?.steps.map(step => step.step) || [];

              return {
                ...recipe,
                title: recipe.title || spoonacularData.data.title,
                image: recipe.image || spoonacularData.data.image,
                readyInMinutes: recipe.readyInMinutes || spoonacularData.data.readyInMinutes,
                servings: recipe.servings || spoonacularData.data.servings,
                ingredients: ingredients,
                instructions: instructions,
                total_ingredients: ingredients.length,
                total_steps: instructions.length
              };
            } catch (error) {
              console.error(`Error fetching Spoonacular data for recipe ${recipe.recipe_id}:`, error.response?.data || error.message);
              return recipe;
            }
          })
        );
        return {
          plan_id: plan.plan_id,
          user_id: plan.user_id,
          name: plan.name,
          created_at: plan.created_at,
          recipes: recipesWithDetails
        };
      })
    );
    console.log("Final response:", JSON.stringify(plansWithRecipes, null, 2));
    res.status(200).send(plansWithRecipes);
  } catch (error) {
    console.error("Error in GET /meal-plan:", error);
    next(error);
  }
});

// Create new meal plan
router.post("/create", async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).send({ message: "Meal plan name is required" });
    }

    const result = await DButils.execQuery(
      `INSERT INTO meal_plans (user_id, name) VALUES (?, ?)`,
      [req.session.user_id, name]
    );

    res.status(201).send({ 
      message: "Meal plan created successfully",
      plan_id: result.insertId
    });
  } catch (error) {
    console.error("Error in POST /meal-plan/create:", error);
    next(error);
  }
});

// Add recipe to meal plan
router.post("/add", async (req, res, next) => {
  try {
    const { recipe_id, plan_id } = req.body;
    if (!recipe_id) {
      return res.status(400).send({ message: "Recipe ID is required" });
    }

    // If plan_id is not provided, get all user's meal plans
    if (!plan_id) {
      const [plans] = await DButils.execQuery(
        `SELECT * FROM meal_plans WHERE user_id = ?`,
        [req.session.user_id]
      );

      if (!plans || plans.length === 0) {
        return res.status(404).send({ 
          message: "No meal plans found. Please create a meal plan first.",
          needsPlan: true
        });
      }

      return res.status(200).send({ 
        message: "Please select a meal plan",
        plans: plans
      });
    }

    // Check if recipe already exists in meal plan
    const [existing] = await DButils.execQuery(
      `SELECT recipe_id FROM meal_plan_recipes WHERE plan_id = ? AND recipe_id = ?`,
      [plan_id, recipe_id]
    );

    if (existing && existing.length > 0) {
      return res.status(400).send({ message: "Recipe already in meal plan" });
    }

    // Get current max order
    const [maxOrder] = await DButils.execQuery(
      `SELECT MAX(recipe_order) as max_order FROM meal_plan_recipes WHERE plan_id = ?`,
      [plan_id]
    );

    const nextOrder = (maxOrder && maxOrder[0] && maxOrder[0].max_order ? maxOrder[0].max_order : 0) + 1;

    // Add recipe to meal plan
    await DButils.execQuery(
      `INSERT INTO meal_plan_recipes (plan_id, recipe_id, recipe_order, progress) 
       VALUES (?, ?, ?, ?)`,
      [plan_id, recipe_id, nextOrder, 'Not Started']
    );

    res.status(201).send({ message: "Recipe added to meal plan" });
  } catch (error) {
    console.error("Error in POST /meal-plan/add:", error);
    next(error);
  }
});

// Update recipe order in meal plan
router.put("/reorder", async (req, res, next) => {
  try {
    const { recipe_id, new_order, plan_id } = req.body;
    console.log(`Received reorder request for plan_id: ${plan_id}, recipe_id: ${recipe_id}, new_order: ${new_order}`);

    if (!recipe_id || typeof new_order !== 'number' || !plan_id) {
      return res.status(400).send({ message: "Recipe ID, new order, and plan ID are required" });
    }

    const updateResult = await DButils.execQuery(
      `UPDATE meal_plan_recipes SET recipe_order = ? 
       WHERE plan_id = ? AND recipe_id = ?`,
      [new_order, plan_id, recipe_id]
    );
    console.log("DB Update Result:", updateResult);

    res.status(200).send({ message: "Recipe order updated" });
  } catch (error) {
    console.error("Error in PUT /meal-plan/reorder:", error);
    next(error);
  }
});

// Remove recipe from meal plan
router.delete("/remove/:recipe_id", async (req, res, next) => {
  try {
    // Get user's meal plan
    const [plans] = await DButils.execQuery(
      `SELECT plan_id FROM meal_plans WHERE user_id = ?`,
      [req.session.user_id]
    );

    if (!plans || plans.length === 0) {
      return res.status(404).send({ message: "Meal plan not found" });
    }

    await DButils.execQuery(
      `DELETE FROM meal_plan_recipes 
       WHERE plan_id = ? AND recipe_id = ?`,
      [plans[0].plan_id, req.params.recipe_id]
    );

    res.status(200).send({ message: "Recipe removed from meal plan" });
  } catch (error) {
    console.error("Error in DELETE /meal-plan/remove:", error);
    next(error);
  }
});

// Clear meal plan
router.delete("/clear", async (req, res, next) => {
  try {
    // Get all user's meal plans
    const plans = await DButils.execQuery(
      `SELECT plan_id FROM meal_plans WHERE user_id = ?`,
      [req.session.user_id]
    );

    if (!plans || plans.length === 0) {
      return res.status(404).send({ message: "No meal plans found" });
    }

    // Clear all recipes from all meal plans
    for (const plan of plans) {
      await DButils.execQuery(
        `DELETE FROM meal_plan_recipes WHERE plan_id = ?`,
        [plan.plan_id]
      );
    }

    res.status(200).send({ message: "All meal plans cleared" });
  } catch (error) {
    console.error("Error in DELETE /meal-plan/clear:", error);
    next(error);
  }
});

// Update recipe progress
router.put("/progress/:recipe_id", async (req, res, next) => {
  try {
    const { progress, plan_id } = req.body;
    const allowed = ["Not Started", "In Progress", "Completed"];
    if (!allowed.includes(progress)) {
      return res.status(400).send({ message: "Invalid progress value" });
    }

    // Get user's meal plans
    if (!plan_id) {
      return res.status(400).send({ message: "Plan ID is required to update meal plan recipe progress." });
    }

    await DButils.execQuery(
      `UPDATE meal_plan_recipes SET progress = ? 
       WHERE plan_id = ? AND recipe_id = ?`,
      [progress, plan_id, req.params.recipe_id]
    );

    res.status(200).send({ message: "Progress updated" });
  } catch (error) {
    console.error("Error in PUT /meal-plan/progress:", error);
    next(error);
  }
});

// Delete meal plan
router.delete("/:planId", async (req, res, next) => {
  try {
    const { planId } = req.params;
    if (!planId) {
      return res.status(400).send({ message: "Meal plan ID is required" });
    }

    // Check if the meal plan belongs to the current user
    const [plan] = await DButils.execQuery(
      `SELECT plan_id FROM meal_plans WHERE plan_id = ? AND user_id = ?`,
      [planId, req.session.user_id]
    );

    if (!plan || plan.length === 0) {
      return res.status(404).send({ message: "Meal plan not found or does not belong to user" });
    }

    // Delete all recipes associated with the meal plan
    await DButils.execQuery(
      `DELETE FROM meal_plan_recipes WHERE plan_id = ?`,
      [planId]
    );

    // Delete the meal plan itself
    await DButils.execQuery(
      `DELETE FROM meal_plans WHERE plan_id = ?`,
      [planId]
    );

    res.status(200).send({ message: "Meal plan deleted successfully" });
  } catch (error) {
    console.error("Error in DELETE /meal-plan/:planId:", error);
    next(error);
  }
});

module.exports = router;
