const DButils = require("./DButils");
const recipes_utils = require("./recipes_utils");

/**
 * Mark a recipe as favorite
 */
async function markAsFavorite(user_id, recipe_id) {
  await DButils.execQuery(`
    INSERT INTO user_favorites (user_id, recipe_id)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE user_id = user_id
  `, [user_id, recipe_id]);
}

/**
 * Get user's favorite recipes
 */
async function markAsFavorite(user_id, recipe_id) {
  await DButils.execQuery(`
    INSERT INTO user_favorites (user_id, recipe_id)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE favorited_at = CURRENT_TIMESTAMP
  `, [user_id, recipe_id]);
}
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
 * Add a recipe to the meal plan
 */
async function addToMealPlan(user_id, recipe_id) {
  await DButils.execQuery(`
    INSERT INTO meal_plan (user_id, recipe_id)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE recipe_id = recipe_id
  `, [user_id, recipe_id]);
}

/**
 * Get meal plan for user
 */
async function getMealPlan(user_id) {
  const rows = await DButils.execQuery(`
    SELECT * FROM meal_plan WHERE user_id = ?
  `, [user_id]);

  return rows;
}

/**
 * Remove from meal plan
 */
async function removeFromMealPlan(user_id, recipe_id) {
  await DButils.execQuery(`
    DELETE FROM meal_plan WHERE user_id = ? AND recipe_id = ?
  `, [user_id, recipe_id]);
}

/**
 * Update progress in meal plan
 */
async function updateMealPlanProgress(user_id, recipe_id, progress) {
  await DButils.execQuery(`
    UPDATE meal_plan SET progress = ? WHERE user_id = ? AND recipe_id = ?
  `, [progress, user_id, recipe_id]);
}

/**
 * Update meal plan order (day & meal_type)
 */
async function updateMealPlanOrder(user_id, updates) {
  for (const { recipe_id, day_of_week, meal_type } of updates) {
    await DButils.execQuery(`
      UPDATE meal_plan SET day_of_week = ?, meal_type = ?
      WHERE user_id = ? AND recipe_id = ?
    `, [day_of_week, meal_type, user_id, recipe_id]);
  }
}

async function getFavoriteRecipes(user_id) {
  // Get all favorited recipe IDs
  const rows = await DButils.execQuery(
    `SELECT recipe_id FROM user_favorites WHERE user_id = ?`,
    [user_id]
  );

  const recipeIds = rows.map(row => row.recipe_id);

  const results = [];

  for (const id of recipeIds) {
    const local = await DButils.execQuery(
      `SELECT * FROM recipes WHERE recipe_id = ?`,
      [id]
    );

    if (local.length > 0) {
      results.push(local[0]);
    } else {
      try {
        const external = await recipes_utils.getRecipePreview(id);
        results.push(external);
      } catch (err) {
        console.warn(`Could not fetch recipe ${id} from Spoonacular:`, err.message);
      }
    }
  }

  return results;
}

/**
 * Add a recipe to preparation progress
 */
async function addPrepareRecipe(recipe_id, user_id) {
  let servings = 1;

  const localRecipe = await DButils.execQuery(
    `SELECT * FROM recipes WHERE recipe_id = ?`,
    [recipe_id]
  );

  if (localRecipe.length > 0) {
    servings = localRecipe[0].servings || 1;
  } else {
    try {
      const spoonacular = await recipes_utils.getRecipeInformation(recipe_id,user_id);
      servings = spoonacular?.servings || 1;
    } catch (e) {
      throw { status: 404, message: "Recipe not found (Spoonacular API failed)" };
    }
  }

  await DButils.execQuery(
    `INSERT INTO recipe_progress (user_id, recipe_id, servings, current_step)
     VALUES (?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE servings = VALUES(servings), current_step = 0`,
    [user_id, recipe_id, servings]
  );
}

async function updateRecipeProgress(recipe_id, user_id, step_number) {
  await DButils.execQuery(
    `UPDATE recipe_progress 
     SET current_step = ? 
     WHERE user_id = ? AND recipe_id = ?`,
    [step_number, user_id, recipe_id]
  );
}

async function scaleRecipeServings(recipe_id, user_id, new_servings) {
  try {
    // Fetch the original number of servings
    const original = await DButils.execQuery(
      `SELECT servings FROM recipe_progress WHERE recipe_id = ? AND user_id = ?`,
      [recipe_id, user_id]
    );

    if (original.length === 0) {
      throw { status: 404, message: "No preparation record found for this recipe." };
    }

    const original_servings = original[0].servings;
    if (original_servings === 0) {
      throw { status: 400, message: "Original servings cannot be zero." };
    }

    // Update servings in recipe_progress
    await DButils.execQuery(
      `UPDATE recipe_progress SET servings = ? WHERE recipe_id = ? AND user_id = ?`,
      [new_servings, recipe_id, user_id]
    );

    // Return scale ratio if needed
    return {
      message: "Servings updated",
      scale_factor: new_servings / original_servings
    };
  } catch (error) {
    throw { status: 500, message: error.message || "Error scaling servings" };
  }
}


async function getRecipePreparation(recipe_id, user_id) {
  // Check progress entry
  const progressRows = await DButils.execQuery(
    `SELECT servings, current_step FROM recipe_progress
     WHERE user_id = ? AND recipe_id = ?`,
    [user_id, recipe_id]
  );

  if (progressRows.length === 0) {
    throw { status: 404, message: "Recipe not started by user" };
  }

  const progress = progressRows[0];

  // Try local recipe
  const localRecipe = await DButils.execQuery(
    `SELECT * FROM recipes WHERE recipe_id = ?`,
    [recipe_id]
  );

  let recipe;
  if (localRecipe.length > 0) {
    recipe = localRecipe[0];
  } else {
    // Fetch from Spoonacular
    recipe = await recipes_utils.getRecipeInformation(recipe_id);
    if (!recipe) {
      throw { status: 404, message: "Recipe not found" };
    }
  }

  return {
    ...recipe,
    servings: progress.servings,
    current_step: progress.current_step
  };
}

async function transformFamilyRecipeData(recipe) {
  return {
    id: recipe.family_recipe_id,
    title: recipe.title,
    owner: recipe.owner,
    occasion: recipe.occasion,
    image: recipe.image || '/deafult_recipe_image.png',
    ingredients: JSON.parse(recipe.ingredients || '[]'),
    instructions: JSON.parse(recipe.instructions || '[]'),
  };
}

async function getFamilyRecipes(user_id) {
  try {
    const recipes = await DButils.execQuery(
      "SELECT * FROM family_recipes WHERE user_id = ?",
      [user_id]
    );
    return recipes.map(transformFamilyRecipeData);
  } catch (error) {
    throw error;
  }
}

async function addFamilyRecipe(user_id, recipeData) {
  const {
    title,
    owner,
    occasion,
    image,
    ingredients,
    instructions
  } = recipeData;

  await DButils.execQuery(
    `INSERT INTO family_recipes (
      user_id, title, owner, occasion, image, ingredients, instructions
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      user_id, title, owner, occasion, image || null,
      JSON.stringify(ingredients || []),
      JSON.stringify(instructions || []),
    ]
  );
  return { message: "Family recipe added successfully" };
}

module.exports = {
  addPrepareRecipe,
  markAsFavorite,
  getFavoriteRecipes,
  getUserProfile,
  updateUserProfile,
  getUserRecipes,
  markAsWatched,
  getLastWatchedRecipes,
  getRecipePreparation,
  addToMealPlan,
  getMealPlan,
  removeFromMealPlan,
  updateMealPlanProgress,
  updateMealPlanOrder,
  updateRecipeProgress,
  scaleRecipeServings,
  getFamilyRecipes,
  addFamilyRecipe,
};
