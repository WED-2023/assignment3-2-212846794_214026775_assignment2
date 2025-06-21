const DButils = require("./DButils");
const recipes_utils = require("./recipes_utils");

/**
 * Mark a recipe as favorite
 */
async function markAsFavorite(user_id, recipe_id) {
  await DButils.execQuery(`
    INSERT INTO user_favorites (user_id, recipe_id)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE favorited_at = CURRENT_TIMESTAMP
  `, [user_id, recipe_id]);
}

/**
 * Get user profile
 */
async function getUserProfile(user_id) {
  const rows = await DButils.execQuery(`
    SELECT username, firstname, lastname, country, email, profile_pic
    FROM users WHERE user_id = ?
  `, [user_id]);
  return rows[0];
}

/**
 * Update user profile
 */
async function updateUserProfile(user_id, profile) {
  const fields = [];
  const values = [];

  if (profile.firstName !== undefined) {
    fields.push("firstname = ?");
    values.push(profile.firstName);
  }
  if (profile.lastName !== undefined) {
    fields.push("lastname = ?");
    values.push(profile.lastName);
  }
  if (profile.country !== undefined) {
    fields.push("country = ?");
    values.push(profile.country);
  }
  if (profile.email !== undefined) {
    fields.push("email = ?");
    values.push(profile.email);
  }
  if (profile.profile_pic !== undefined) {
    fields.push("profile_pic = ?");
    values.push(profile.profile_pic);
  }

  if (fields.length === 0) return;

  await DButils.execQuery(
    `UPDATE users SET ${fields.join(", ")} WHERE user_id = ?`,
    [...values, user_id]
  );
}

/**
 * Get user's custom recipes
 */
async function getUserRecipes(username) {
  const user = await DButils.execQuery(`SELECT user_id FROM users WHERE username = ?`, [username]);
  if (user.length === 0) throw { status: 404, message: "User not found" };

  return await DButils.execQuery(`SELECT * FROM recipes WHERE user_id = ?`, [user[0].user_id]);
}

/**
 * Mark a recipe as watched
 */
async function markAsWatched(user_id, recipe_id) {
  await DButils.execQuery(`
    INSERT INTO last_watched_recipes (user_id, recipe_id)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE viewed_at = CURRENT_TIMESTAMP
  `, [user_id, recipe_id]);

  // Keep only 3 latest watched
  await DButils.execQuery(`
    DELETE FROM last_watched_recipes
    WHERE user_id = ? AND recipe_id NOT IN (
      SELECT recipe_id FROM (
        SELECT recipe_id
        FROM last_watched_recipes
        WHERE user_id = ?
        ORDER BY viewed_at DESC
        LIMIT 3
      ) AS temp
    )
  `, [user_id, user_id]);
}

/**
 * Get last watched recipes
 */
async function getLastWatchedRecipes(user_id) {
  const rows = await DButils.execQuery(`
    SELECT recipe_id FROM last_watched_recipes
    WHERE user_id = ?
    ORDER BY viewed_at DESC
    LIMIT 3
  `, [user_id]);

  const ids = rows.map(r => r.recipe_id);
  return await recipes_utils.getRecipesPreview(ids);
}

/**
 * Add a recipe to preparation progress
 */
async function addPrepareRecipe(recipe_id, user_id, plan_id = null) {
  let servings = 1;

  const localRecipe = await DButils.execQuery(
    `SELECT * FROM recipes WHERE recipe_id = ?`,
    [recipe_id]
  );

  if (localRecipe.length > 0) {
    servings = localRecipe[0].servings || 1;
  } else {
    try {
      const spoonacular = await recipes_utils.getRecipeInformation(recipe_id, user_id);
      servings = spoonacular?.servings || 1;
    } catch (e) {
      throw { status: 404, message: "Recipe not found (Spoonacular API failed)" };
    }
  }

  // Check if a progress entry already exists
  const existingProgress = await DButils.execQuery(
    `SELECT current_preperation_step, current_ingredient_step FROM recipe_progress WHERE user_id = ? AND recipe_id = ?`,
    [user_id, recipe_id]
  );

  if (existingProgress.length > 0) {
    // If progress exists, update servings and plan_id, but preserve steps
    await DButils.execQuery(
      `UPDATE recipe_progress SET plan_id = ?, servings = ? WHERE user_id = ? AND recipe_id = ?`,
      [plan_id, servings, user_id, recipe_id]
    );
  } else {
    // If no progress exists, create a new entry
    await DButils.execQuery(
      `INSERT INTO recipe_progress (user_id, recipe_id, plan_id, servings, current_preperation_step, current_ingredient_step)
       VALUES (?, ?, ?, ?, 0, 0)`,
      [user_id, recipe_id, plan_id, servings]
  );
}
}

/**
 * Update recipe progress
 */
async function updateRecipeProgress(recipe_id, user_id, step_number) {
  await DButils.execQuery(
    `UPDATE recipe_progress SET current_preperation_step = ? WHERE user_id = ? AND recipe_id = ?`,
    [step_number, user_id, recipe_id]
  );
}

/**
 * Scale recipe servings
 */
async function scaleRecipeServings(recipe_id, user_id, new_servings, plan_id = null) {
    await DButils.execQuery(
    `UPDATE recipe_progress SET servings = ?, plan_id = ? WHERE user_id = ? AND recipe_id = ?`,
    [new_servings, plan_id, user_id, recipe_id]
  );
}

/**
 * Get recipe preparation data
 */
async function getRecipePreparation(recipe_id, user_id, plan_id = null) {
  const progress = await DButils.execQuery(
    `SELECT * FROM recipe_progress WHERE user_id = ? AND recipe_id = ?`,
    [user_id, recipe_id]
  );

  if (progress.length === 0) {
    throw { status: 404, message: "Recipe preparation not found" };
  }

  const recipe = await recipes_utils.getRecipeInformation(recipe_id, user_id);
  return {
    ...recipe,
    current_preperation_step: progress[0].current_preperation_step,
    current_ingredient_step: progress[0].current_ingredient_step,
    servings: progress[0].servings,
    plan_id: progress[0].plan_id
  };
}

/**
 * Get user's favorite recipes
 */
async function getFavoriteRecipes(user_id) {
  // Get all favorited recipe IDs
  const rows = await DButils.execQuery(
    `SELECT recipe_id FROM user_favorites WHERE user_id = ?`,
    [user_id]
  );

  const recipeIds = rows.map(row => row.recipe_id);
  const results = [];

  for (const id of recipeIds) {
    // First check if it's a local recipe
    const local = await DButils.execQuery(
      `SELECT * FROM recipes WHERE recipe_id = ?`,
      [id]
    );

    if (local.length > 0) {
      // It's a local recipe, add it directly
      results.push(local[0]);
      continue;
    }

    // Check if it's a family recipe
    const family = await DButils.execQuery(
      `SELECT * FROM family_recipes WHERE recipe_id = ?`,
      [id]
    );

    if (family.length > 0) {
      // It's a family recipe, transform and add it
      const transformed = await transformFamilyRecipeData(family[0]);
      results.push(transformed);
      continue;
    }

    // If not found locally, try Spoonacular
    try {
      const external = await recipes_utils.getRecipePreview(id);
      results.push(external);
    } catch (err) {
      console.warn(`Could not fetch recipe ${id} from Spoonacular:`, err.message);
      // Skip this recipe instead of failing
      continue;
    }
  }

  return results;
}

/**
 * Transform family recipe data
 */
async function transformFamilyRecipeData(recipe) {
  return {
    ...recipe,
    ingredients: JSON.parse(recipe.ingredients || '[]'),
    instructions: recipe.instructions.split('\n').filter(step => step.trim())
  };
}

/**
 * Get user's family recipes
 */
async function getFamilyRecipes(user_id) {
    const recipes = await DButils.execQuery(
    `SELECT * FROM family_recipes WHERE user_id = ?`,
      [user_id]
    );

  return Promise.all(recipes.map(transformFamilyRecipeData));
}

/**
 * Add a new family recipe
 */
async function addFamilyRecipe(user_id, recipeData) {
  const { title, owner, whenToPrepare, readyInMinutes, vegetarian, vegan, glutenFree, instructions, image, ingredients } = recipeData;

  const result = await DButils.execQuery(
    `INSERT INTO family_recipes (
      user_id, title, owner, when_to_prepare, ready_in_minutes,
      vegetarian, vegan, gluten_free, instructions, image, ingredients
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user_id, title, owner, whenToPrepare, readyInMinutes,
      vegetarian, vegan, glutenFree, instructions, image,
      JSON.stringify(ingredients)
    ]
  );

  return result.insertId;
}

/**
 * Add a recipe to meal plan
 */
async function addRecipeToMealPlan(user_id, recipe_id, plan_id, day_of_week, meal_type) {
  // Check if the meal plan exists and belongs to the user
  const plan = await DButils.execQuery(
    `SELECT plan_id FROM meal_plans WHERE plan_id = ? AND user_id = ?`,
    [plan_id, user_id]
    );

  if (plan.length === 0) {
    throw { status: 404, message: "Meal plan not found or does not belong to user" };
  }

  // Add the recipe to the meal plan
    await DButils.execQuery(
    `INSERT INTO meal_plan_recipes (plan_id, recipe_id, day_of_week, meal_type)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE day_of_week = ?, meal_type = ?`,
    [plan_id, recipe_id, day_of_week, meal_type, day_of_week, meal_type]
  );
}

/**
 * Get user's meal plans
 */
async function getUserMealPlan(user_id) {
  // Get all meal plans for the user
  const plans = await DButils.execQuery(
      `SELECT * FROM meal_plans WHERE user_id = ?`,
      [user_id]
    );

  // For each plan, get its recipes
  for (const plan of plans) {
    const recipes = await DButils.execQuery(
      `SELECT mpr.*, r.* 
       FROM meal_plan_recipes mpr 
       LEFT JOIN recipes r ON mpr.recipe_id = r.recipe_id 
       WHERE mpr.plan_id = ?`,
      [plan.plan_id]
    );

    plan.recipes = recipes;
  }

  return plans;
}

/**
 * Remove recipe from meal plan
 */
async function removeRecipeFromMealPlan(user_id, recipe_id, plan_id) {
  // Check if the meal plan exists and belongs to the user
  const plan = await DButils.execQuery(
    `SELECT plan_id FROM meal_plans WHERE plan_id = ? AND user_id = ?`,
    [plan_id, user_id]
    );

  if (plan.length === 0) {
    throw { status: 404, message: "Meal plan not found or does not belong to user" };
    }

  // Remove the recipe from the meal plan
    await DButils.execQuery(
    `DELETE FROM meal_plan_recipes WHERE plan_id = ? AND recipe_id = ?`,
    [plan_id, recipe_id]
    );
}

/**
 * Update meal plan recipe progress
 */
async function updateMealPlanProgress(user_id, recipe_id, progress, plan_id) {
  // Check if the meal plan exists and belongs to the user
  const plan = await DButils.execQuery(
    `SELECT plan_id FROM meal_plans WHERE plan_id = ? AND user_id = ?`,
    [plan_id, user_id]
    );

  if (plan.length === 0) {
    throw { status: 404, message: "Meal plan not found or does not belong to user" };
    }

  // Update the recipe's progress in the meal plan
    await DButils.execQuery(
    `UPDATE meal_plan_recipes SET progress = ? WHERE plan_id = ? AND recipe_id = ?`,
    [progress, plan_id, recipe_id]
    );
}

module.exports = {
  markAsFavorite,
  getUserProfile,
  updateUserProfile,
  getUserRecipes,
  markAsWatched,
  getLastWatchedRecipes,
  addPrepareRecipe,
  updateRecipeProgress,
  scaleRecipeServings,
  getRecipePreparation,
  getFavoriteRecipes,
  transformFamilyRecipeData,
  getFamilyRecipes,
  addFamilyRecipe,
  addRecipeToMealPlan,
  getUserMealPlan,
  removeRecipeFromMealPlan,
  updateMealPlanProgress
};