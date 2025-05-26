const DButils = require("./DButils");
const recipe_utils = require("./recipes_utils");

/**
 * Mark a recipe as favorite for a user
 * @param {number} user_id - The user's ID
 * @param {number} recipe_id - The recipe's ID
 */
async function markAsFavorite(user_id, recipe_id) {
  try {
    console.log('Marking recipe as favorite:', { user_id, recipe_id });
    
    // Add to favorites with current timestamp
    const favoriteQuery = `
      INSERT INTO favorite_recipes (user_id, recipe_id, favorited_at)
      VALUES (${user_id}, ${recipe_id}, CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE favorited_at = CURRENT_TIMESTAMP`;
    
    console.log('Adding to favorites with query:', favoriteQuery);
    await DButils.execQuery(favoriteQuery);
    console.log('Added to favorites successfully');

    return { message: "Recipe successfully saved as favorite" };
  } catch (error) {
    console.error("Error in markAsFavorite:", {
      message: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage,
      sql: error.sql
    });
    throw { status: 500, message: error.message };
  }
}

/**
 * Get all favorite recipes for a user
 * @param {number} user_id - The user's ID
 * @returns {Promise<Array>} Array of favorite recipe IDs
 */
async function getFavoriteRecipes(user_id) {
  try {
    console.log('Getting favorite recipes for user:', user_id);
    // Get only the recipe IDs from favorites
    const favorites = await DButils.execQuery(
      `SELECT recipe_id 
       FROM favorite_recipes
       WHERE user_id = ${user_id}
       ORDER BY favorited_at DESC`
    );
    
    // Fetch recipe details from Spoonacular for each favorite
    const favoriteRecipes = await Promise.all(
      favorites.map(async (fav) => {
        try {
          const recipeDetails = await recipe_utils.getRecipeDetails(fav.recipe_id);
          return {
            ...recipeDetails,
            isFavorite: true
          };
        } catch (error) {
          console.error(`Error fetching recipe ${fav.recipe_id}:`, error);
          return null;
        }
      })
    );

    return favoriteRecipes.filter(recipe => recipe !== null);
  } catch (error) {
    console.error('Error in getFavoriteRecipes:', error);
    throw error;
  }
}

/**
 * Get user profile information
 * @param {number} user_id - The user's ID
 * @returns {Promise<Object>} User profile information
 */
async function getUserProfile(user_id) {
  const user = await DButils.execQuery(
    `SELECT user_id, username, firstname, lastname, country, email, profilePic 
     FROM users WHERE user_id = ${user_id}`
  );
  return user[0];
}

/**
 * Update user profile information
 * @param {number} user_id - The user's ID
 * @param {Object} profile - The updated profile information
 */
async function updateUserProfile(user_id, profile) {
  const { firstname, lastname, country, email, profilePic } = profile;
  await DButils.execQuery(
    `UPDATE users 
     SET firstname = '${firstname}', 
         lastname = '${lastname}', 
         country = '${country}', 
         email = '${email}', 
         profilePic = '${profilePic}'
     WHERE user_id = ${user_id}`
  );
}

async function getMyRecipes(user_id) {
  const myRecipes = await DButils.execQuery(`SELECT * FROM recipes WHERE user_id=${user_id}`);
  return myRecipes;
}

async function getMyRecipe(user_id, recipe_id) {
  const myRecipe = await DButils.execQuery(`SELECT * FROM recipes WHERE user_id = ${user_id} AND recipe_id = ${recipe_id}`);
  return myRecipe;
}

async function getMyFamilyRecipes(user_id) {
  const myFamilyRecipes = await DButils.execQuery(`
    SELECT * FROM family_recipes WHERE created_by = ${user_id}
  `);
  return myFamilyRecipes;
}

async function markAsFamilyRecipe(recipe_id, user_id, owner, whenToPrepare, title, readyInMin, vegetarian, vegan, glutenFree, image, instructions, ingredients) {
  try {
    // First, add the recipe to the recipes table
    const recipeQuery = `
      INSERT INTO recipes (
        recipe_id,
        user_id,
        title,
        readyInMinutes,
        vegetarian,
        vegan,
        glutenFree,
        servings,
        instructions,
        ingredients,
        image,
        source
      ) VALUES (
        ${recipe_id},
        ${user_id},
        '${title.replace(/'/g, "''")}',
        ${readyInMin},
        ${vegetarian ? 1 : 0},
        ${vegan ? 1 : 0},
        ${glutenFree ? 1 : 0},
        1,
        '${instructions.replace(/'/g, "''")}',
        '${JSON.stringify(ingredients).replace(/'/g, "''")}',
        '${image.replace(/'/g, "''")}',
        'custom'
      )`;

    console.log('Inserting recipe with query:', recipeQuery);
    await DButils.execQuery(recipeQuery);
    console.log('Recipe inserted successfully');

    // Then, add the family recipe reference with only the family-specific fields
    const familyQuery = `
      INSERT INTO family_recipes (
        created_by,
        family_member,
        occasion,
        title,
        ingredients,
        instructions,
        images
      ) VALUES (
        ${user_id},
        '${owner.replace(/'/g, "''")}',
        '${whenToPrepare.replace(/'/g, "''")}',
        '${title.replace(/'/g, "''")}',
        '${JSON.stringify(ingredients).replace(/'/g, "''")}',
        '${instructions.replace(/'/g, "''")}',
        '${JSON.stringify([image]).replace(/'/g, "''")}'
      )`;

    console.log('Inserting family recipe reference with query:', familyQuery);
    await DButils.execQuery(familyQuery);
    console.log('Family recipe reference inserted successfully');

    return { message: "Family recipe successfully added" };
  } catch (error) {
    console.error('Error in markAsFamilyRecipe:', error);
    throw error;
  }
}

async function getFamilyRecipe(user_id, recipe_id) {
  const familyRecipe = await DButils.execQuery(`
    SELECT 
      r.*,
      fr.family_member,
      fr.occasion
    FROM recipes r
    JOIN family_recipes fr ON r.recipe_id = fr.family_recipe_id
    WHERE fr.created_by = ${user_id} AND fr.family_recipe_id = ${recipe_id}
  `);
  return familyRecipe[0];
}

async function markAsWatched(user_id, recipe_id) {
  try {
    console.log('Marking recipe as watched:', { user_id, recipe_id });
    
    // Remove existing record (to reset timestamp)
    await DButils.execQuery(
      `DELETE FROM last_watched_recipes WHERE user_id = ${user_id} AND recipe_id = ${recipe_id}`
    );

    // Insert new one with current time
    await DButils.execQuery(
      `INSERT INTO last_watched_recipes (user_id, recipe_id, viewed_at)
       VALUES (${user_id}, ${recipe_id}, CURRENT_TIMESTAMP)`
    );

    // Keep only the last 3 watched recipes for this user
    await DButils.execQuery(`
      DELETE FROM last_watched_recipes 
      WHERE user_id = ${user_id} 
      AND recipe_id NOT IN (
        SELECT recipe_id FROM (
          SELECT recipe_id 
          FROM last_watched_recipes 
          WHERE user_id = ${user_id} 
          ORDER BY viewed_at DESC 
          LIMIT 3
        ) AS temp
      )
    `);
    
    console.log('Successfully marked recipe as watched and maintained last 3 recipes');
  } catch (error) {
    console.error('Error in markAsWatched:', error);
    throw error;
  }
}

async function getLastWatchedRecipes(user_id) {
  console.log('Getting last watched recipes for user:', user_id);
  try {
    const query = `
      SELECT r.* 
      FROM last_watched_recipes l
      JOIN recipes r ON l.recipe_id = r.recipe_id
      WHERE l.user_id = ${user_id} 
      ORDER BY l.viewed_at DESC 
      LIMIT 3
    `;
    console.log('Executing query:', query);
    
    const lastWatchedRecipes = await DButils.execQuery(query);
    console.log('Last watched recipes query result:', lastWatchedRecipes);
    
    if (!lastWatchedRecipes || lastWatchedRecipes.length === 0) {
      console.log('No recipes found in last_watched_recipes table for user:', user_id);
      return [];
    }
    
    console.log('Found recipes:', lastWatchedRecipes.map(r => r.recipe_id));
    return lastWatchedRecipes;
  } catch (error) {
    console.error('Error getting last watched recipes:', error);
    throw error;
  }
}

/**
 * Get user's meal plan
 */
async function getMealPlan(user_id) {
  try {
    const mealPlan = await DButils.execQuery(
      `SELECT r.recipe_id, r.title, mp.position, mp.progress 
       FROM meal_plan mp 
       JOIN recipes r ON mp.recipe_id = r.recipe_id 
       WHERE mp.user_id = ${user_id} 
       ORDER BY mp.position`
    );
    return { recipes: mealPlan };
  } catch (error) {
    throw { status: 500, message: "Error getting meal plan" };
  }
}

/**
 * Add recipe to meal plan
 */
async function addToMealPlan(user_id, recipe_id, position) {
  try {
    // Check if recipe exists in our database
    const recipe = await DButils.execQuery(
      `SELECT recipe_id FROM recipes WHERE recipe_id = ${recipe_id}`
    );
    
    // If recipe doesn't exist in our database, it's a Spoonacular recipe
    // We don't need to check for existence since we removed the foreign key constraint
    
    // Add to meal plan
    await DButils.execQuery(
      `INSERT INTO meal_plan (user_id, recipe_id, position) 
       VALUES (${user_id}, ${recipe_id}, ${position})`
    );
    
    return { message: "Recipe successfully added to meal plan" };
  } catch (error) {
    console.error("Error in addToMealPlan:", error);
    throw { status: 500, message: "Error adding recipe to meal plan" };
  }
}

/**
 * Remove recipe from meal plan
 */
async function removeFromMealPlan(user_id, recipe_id) {
  try {
    const result = await DButils.execQuery(
      `DELETE FROM meal_plan 
       WHERE user_id = ${user_id} AND recipe_id = ${recipe_id}`
    );
    if (result.affectedRows === 0) {
      throw { status: 404, message: "Recipe not found in meal plan" };
    }
  } catch (error) {
    throw { status: 500, message: "Error removing recipe from meal plan" };
  }
}

/**
 * Get user's created recipes
 */
async function getUserRecipes(username) {
  try {
    const user = await DButils.execQuery(
      `SELECT user_id FROM users WHERE username = '${username}'`
    );
    if (user.length === 0) {
      throw { status: 404, message: "User not found" };
    }

    const recipes = await DButils.execQuery(
      `SELECT * FROM recipes WHERE user_id = ${user[0].user_id}`
    );
    return recipes;
  } catch (error) {
    throw { status: 500, message: "Error getting user recipes" };
  }
}

// Export all functions
module.exports = {
  markAsFavorite,
  getFavoriteRecipes,
  getUserProfile,
  updateUserProfile,
  getMyRecipes,
  getMyRecipe,
  getMyFamilyRecipes,
  markAsFamilyRecipe,
  getFamilyRecipe,
  markAsWatched,
  getLastWatchedRecipes,
  getMealPlan,
  addToMealPlan,
  removeFromMealPlan,
  getUserRecipes
};

