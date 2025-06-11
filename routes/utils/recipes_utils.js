const axios = require("axios");
const DButils = require("./DButils");
const api_domain = "https://api.spoonacular.com/recipes";
const SPOONACULAR_API_KEY = process.env.SPOONACULAR_API_KEY;

/**
 * Transform Spoonacular or DB-stored recipe to uniform format
 */
function transformRecipeData(recipe, source = "spoonacular") {
  const defaultImage = '/default_recipe_image.png';
  const defaultSummary = 'No summary available.';
  
  return {
    id: recipe.recipe_id || recipe.id,
    title: recipe.title,
    image: recipe.image || defaultImage,
    readyInMinutes: recipe.readyInMinutes || recipe.ready_in_minutes || 0,
    preparationMinutes: recipe.preparationMinutes || recipe.preparation_minutes || 0,
    cookingMinutes: recipe.cookingMinutes || recipe.cooking_minutes || 0,
    servings: recipe.servings || 0,
    vegetarian: !!(recipe.vegetarian || recipe.isVegetarian),
    vegan: !!(recipe.vegan || recipe.isVegan),
    glutenFree: !!(recipe.glutenFree || recipe.isGlutenFree),
    popularity: recipe.popularity || 0,
    instructions: recipe.instructions || "",
    extendedIngredients: Array.isArray(recipe.extendedIngredients) ? recipe.extendedIngredients : (recipe.extendedIngredients ? JSON.parse(recipe.extendedIngredients) : []),
    dishTypes: Array.isArray(recipe.dishTypes) ? recipe.dishTypes : (recipe.dishTypes ? JSON.parse(recipe.dishTypes) : []),
    cuisines: Array.isArray(recipe.cuisines) ? recipe.cuisines : (recipe.cuisines ? JSON.parse(recipe.cuisines) : []),
    diets: Array.isArray(recipe.diets) ? recipe.diets : (recipe.diets ? JSON.parse(recipe.diets) : []),
    occasions: Array.isArray(recipe.occasions) ? recipe.occasions : (recipe.occasions ? JSON.parse(recipe.occasions) : []),
    winePairing: recipe.winePairing || {},
    healthScore: recipe.healthScore || 0,
    pricePerServing: recipe.pricePerServing || 0,
    sourceName: recipe.sourceName || "",
    sourceUrl: recipe.sourceUrl || "",
    spoonacularSourceUrl: recipe.spoonacularSourceUrl || "",
    summary: recipe.summary || defaultSummary,
    source: source
  };
}

/**
 * Get recipe details by ID from DB or Spoonacular
 */
async function getRecipeInformation(recipeId, user_id=null) {
  console.log(`Backend: Attempting to get information for recipe ID: ${recipeId}`);
  
  let dbRecipe = null;
  try {
    const rows = await DButils.execQuery("SELECT * FROM recipes WHERE recipe_id = ?", [recipeId]);
    if (rows.length > 0) {
      dbRecipe = rows[0];
      console.log(`Backend: Raw DB recipe data for ${recipeId}:`, dbRecipe);
    }
  } catch (dbError) {
    console.error(`Backend: Error fetching recipe ${recipeId} from DB:`, dbError);
  }

  let spoonacularData = null;
  try {
    console.log(`Backend: Fetching Spoonacular data for ${recipeId}...`);
    const response = await axios.get(`${api_domain}/${recipeId}/information`, {
      params: { 
        apiKey: SPOONACULAR_API_KEY,
        addRecipeInformation: true,
        fillIngredients: true,
        instructionsRequired: true,
        addRecipeNutrition: true
      }
    });
    
    if (response.data) {
      spoonacularData = response.data;
      console.log(`Backend: Successfully fetched Spoonacular data for ${recipeId}`);
    } else {
      console.warn(`Backend: No data received from Spoonacular for ${recipeId}`);
    }
  } catch (spoonacularError) {
    console.error(`Backend: Error fetching recipe ${recipeId} from Spoonacular:`, spoonacularError.message);
    if (spoonacularError.response) {
      console.error('Spoonacular API error details:', spoonacularError.response.data);
    }
  }

  // If we have Spoonacular data, use it
  if (spoonacularData) {
    const transformedData = transformRecipeData(spoonacularData, "spoonacular");
    
    // Add favorite status if user is logged in
    if (user_id) {
      const favoriteCheck = await DButils.execQuery(
        "SELECT COUNT(*) as count FROM favorite_recipes WHERE recipe_id = ? AND user_id = ?",
        [recipeId, user_id]
      );
      transformedData.isFavorite = favoriteCheck[0].count > 0 ? 1 : 0;
    }
    
    return transformedData;
  }
  
  // If we have DB data but no Spoonacular data, use DB data
  if (dbRecipe) {
    const transformedData = transformRecipeData(dbRecipe, "db");
    
    // Add favorite status if user is logged in
    if (user_id) {
      const favoriteCheck = await DButils.execQuery(
        "SELECT COUNT(*) as count FROM favorite_recipes WHERE recipe_id = ? AND user_id = ?",
        [recipeId, user_id]
      );
      transformedData.isFavorite = favoriteCheck[0].count > 0 ? 1 : 0;
    }
    
    return transformedData;
  }

  // If we have neither, throw a more specific error
  throw { 
    status: 404, 
    message: `Recipe ${recipeId} not found. Spoonacular API error: ${spoonacularError?.response?.data?.message || 'Unknown error'}`
  };
}

function escape(str) {
  return String(str).replace(/'/g, "''");
}
  
  async function addNewRecipe(body, user_id) {
    const {
      title,
    preparationMinutes,
    cookingMinutes,
      readyInMinutes,
      servings,
      image,
      vegetarian,
      vegan,
      glutenFree,
      instructions,
      extendedIngredients,
      dishTypes,
      cuisines,
      diets,
      occasions,
      winePairing,
      healthScore,
      pricePerServing,
      sourceName,
      sourceUrl,
      summary
    } = body;
  
    const recipe_id = Date.now(); // unique enough
  
    await DButils.execQuery(`
      INSERT INTO recipes (
      recipe_id, user_id, title, image, preparationMinutes, cookingMinutes, readyInMinutes, servings, vegetarian, vegan, glutenFree,
        instructions, extendedIngredients, dishTypes, cuisines, diets, occasions, healthScore, pricePerServing, summary
      ) VALUES (
        ${recipe_id},
        ${user_id},
        '${escape(title)}',
        '${escape(image)}',
      ${preparationMinutes || 0},
      ${cookingMinutes || 0},
      ${readyInMinutes || 0},
      ${servings || 0},
        ${vegetarian ? 1 : 0},
        ${vegan ? 1 : 0},
        ${glutenFree ? 1 : 0},
        '${escape(instructions)}',
        '${escape(JSON.stringify(extendedIngredients || []))}',
        '${escape(JSON.stringify(dishTypes || []))}',
        '${escape(JSON.stringify(cuisines || []))}',
        '${escape(JSON.stringify(diets || []))}',
        '${escape(JSON.stringify(occasions || []))}',
        ${healthScore || 0},
        ${pricePerServing || 0},
        '${escape(summary || "")}'
      )
    `);
  
    return transformRecipeData({ recipe_id, ...body }, "custom");
  }

/**
 * Get preview of recipes
 */
async function getRecipesPreview(ids) {
  const previews = await Promise.all(
    ids.map(async id => {
      try {
        return await getRecipeInformation(id);
      } catch {
        return null;
      }
    })
  );
  return previews.filter(Boolean);
}

/**
 * Get random recipes from Spoonacular
 */
async function getRandomRecipes() {
  const { data } = await axios.get(`${api_domain}/random`, {
    params: {
      apiKey: SPOONACULAR_API_KEY,
      number: 3,
      addRecipeInformation: true
    }
  });

  return data.recipes.map(r => transformRecipeData(r));
}

/**
 * Get trending/popular recipes (same logic)
 */
async function getTrendingRecipes() {
  const { data } = await axios.get(`${api_domain}/complexSearch`, {
    params: {
      apiKey: SPOONACULAR_API_KEY,
      sort: "popularity",
      number: 5,
      addRecipeInformation: true
    }
  });

  return getRecipesPreview(data.results.map(r => r.id));
}

async function getPopularRecipes() {
  const { data } = await axios.get(`${api_domain}/complexSearch`, {
    params: {
      apiKey: SPOONACULAR_API_KEY,
      sort: "popularity",
      number: 10,
      addRecipeInformation: true
    }
  });

  return getRecipesPreview(data.results.map(r => r.id));
}

/**
 * Search both DB and Spoonacular
 */
async function search(query, cuisine, diet, intolerance, limit = 5, sort, sortDirection = 'asc') {
  try {
    // Prepare Spoonacular API parameters
    const params = {
      apiKey: SPOONACULAR_API_KEY,
      query: query || '',
      number: limit,
      addRecipeInformation: true,
      fillIngredients: true,
      instructionsRequired: true,
      addRecipeNutrition: true
    };

    // Add optional filters if provided
    if (cuisine) params.cuisine = cuisine;
    if (diet) params.diet = diet;
    if (intolerance) params.intolerances = intolerance;

    // Add sorting if provided
    if (sort) {
      // Map our sort parameters to Spoonacular's
      switch (sort) {
        case 'readyInMinutes':
          params.sort = 'time';
          break;
        case 'popularity':
          params.sort = 'popularity';
          break;
        case 'calories':
          params.sort = 'calories';
          break;
        default:
          params.sort = sort;
      }
      params.sortDirection = sortDirection;
    }

    console.log('Searching Spoonacular with params:', params);

    // Make the API call
    const { data } = await axios.get(`${api_domain}/complexSearch`, { params });
    
    if (!data || !data.results) {
      console.error('Invalid response from Spoonacular:', data);
      return [];
    }

    // Transform the results
    const transformedResults = data.results.map(recipe => ({
      ...transformRecipeData(recipe),
      totalResults: data.totalResults,
      offset: data.offset,
      number: data.number
    }));

    return transformedResults;

  } catch (error) {
    console.error('Error searching recipes:', error);
    if (error.response) {
      console.error('Spoonacular API error:', error.response.data);
    }
    throw error;
  }
}

/**
 * Add a recipe to user's favorites
 */
async function addToFavorites(user_id, recipe_id) {
      try {
    await DButils.execQuery(
      "INSERT INTO favorite_recipes (user_id, recipe_id) VALUES (?, ?)",
      [user_id, recipe_id]
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new Error("Recipe already in favorites");
      }
    throw error;
  }
}

/**
 * Remove a recipe from user's favorites
 */
async function removeFromFavorites(user_id, recipe_id) {
  await DButils.execQuery(
    "DELETE FROM favorite_recipes WHERE user_id = ? AND recipe_id = ?",
    [user_id, recipe_id]
  );
}

/**
 * Get user's favorite recipes
 */
async function getUserFavorites(user_id) {
  console.log(`Backend: Fetching favorite recipe IDs for user ${user_id}`);
  const favoriteRecipeIds = await DButils.execQuery(
    "SELECT recipe_id FROM favorite_recipes WHERE user_id = ?",
    [user_id]
  );
  const ids = favoriteRecipeIds.map(row => row.recipe_id);
  console.log(`Backend: Found favorite recipe IDs:`, ids);
  // Use getRecipesPreview to fetch full details for all favorited recipe IDs
  const favoriteRecipes = await getRecipesPreview(ids);
  console.log(`Backend: Fetched full favorite recipe details:`, favoriteRecipes);
  return favoriteRecipes;
}

async function getUserRecipes(user_id) {
  try {
    const recipes = await DButils.execQuery(
      "SELECT * FROM recipes WHERE user_id = ?",
      [user_id]
    );
    const recipesWithPopularity = await Promise.all(recipes.map(async (r) => {
      const favoriteCount = await DButils.execQuery(
        "SELECT COUNT(*) as count FROM favorite_recipes WHERE recipe_id = ?",
        [r.recipe_id]
      );
      return transformRecipeData({ ...r, popularity: favoriteCount[0].count }, "custom");
    }));
    return recipesWithPopularity;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  transformRecipeData,
  getRecipeInformation,
  addNewRecipe,
  getRecipesPreview,
  getRandomRecipes,
  getTrendingRecipes,
  getPopularRecipes,
  search,
  addToFavorites,
  removeFromFavorites,
  getUserFavorites,
  getUserRecipes,
};
