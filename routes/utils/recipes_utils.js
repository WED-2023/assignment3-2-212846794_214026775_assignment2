const axios = require("axios");
const DButils = require("./DButils");
const api_domain = "https://api.spoonacular.com/recipes";
const SPOONACULAR_API_KEY = process.env.SPOONACULAR_API_KEY;

/**
 * Transform Spoonacular or DB-stored recipe to uniform format
 */
function transformRecipeData(recipe, source = "spoonacular") {
  const defaultSummary = 'No summary available.';
  
  // Handle ingredients parsing for both Spoonacular and DB/custom recipes
  let formattedIngredients = [];
  let extendedIngredientsParsed = [];

  if (source === 'db' || source === 'custom') {
    // For DB/custom recipes, extendedIngredients might be a JSON string or already an array of strings
    if (typeof recipe.extendedIngredients === 'string') {
      try {
        extendedIngredientsParsed = JSON.parse(recipe.extendedIngredients);
      } catch (e) {
        console.error('Error parsing extendedIngredients for DB/custom recipe:', e);
        extendedIngredientsParsed = []; // Fallback
      }
    } else if (Array.isArray(recipe.extendedIngredients)) {
      extendedIngredientsParsed = recipe.extendedIngredients;
    }
    // If ingredients are just a simple string array (e.g., from an older custom recipe),
    // we might need to handle them directly if they are not in extendedIngredients.
    // Assuming `recipe.ingredients` property might hold plain strings for custom recipes.
    if (Array.isArray(recipe.ingredients)) {
      formattedIngredients = recipe.ingredients;
    } else {
      formattedIngredients = extendedIngredientsParsed.map(ing => {
        if (typeof ing === 'string') return ing;
        return ing.original || `${ing.amount} ${ing.unit} ${ing.nameClean || ing.name}`.trim();
      });
    }
  } else { // Spoonacular source
    if (recipe.extendedIngredients) {
      extendedIngredientsParsed = Array.isArray(recipe.extendedIngredients) 
        ? recipe.extendedIngredients 
        : (typeof recipe.extendedIngredients === 'string' 
            ? JSON.parse(recipe.extendedIngredients) 
            : []);

      formattedIngredients = extendedIngredientsParsed.map(ing => {
        if (typeof ing === 'string') {
          return ing;
        }
        // Use the original string if available, otherwise format it
        return ing.original || `${ing.amount} ${ing.unit} ${ing.nameClean || ing.name}`.trim();
      });
    }
  }
  
  // Ensure instructions are always an array of strings
  let formattedInstructions = [];
  if (typeof recipe.instructions === 'string' && recipe.instructions.trim() !== '') {
    // Split by period and space, or newline for multi-step strings
    formattedInstructions = recipe.instructions
      .split(/\.\s*|\n|\r/)
      .map(step => step.trim())
      .filter(step => step.length > 0);
  } else if (Array.isArray(recipe.instructions)) {
    formattedInstructions = recipe.instructions.filter(step => typeof step === 'string' && step.trim() !== '');
  }
  
  return {
    id: recipe.recipe_id || recipe.id,
    title: recipe.title,
    image: recipe.image,
    readyInMinutes: recipe.readyInMinutes || recipe.ready_in_minutes || 0,
    preparationMinutes: recipe.preparationMinutes || recipe.preparation_minutes || 0,
    cookingMinutes: recipe.cookingMinutes || recipe.cooking_minutes || 0,
    servings: recipe.servings || 0,
    vegetarian: !!(recipe.vegetarian || recipe.isVegetarian),
    vegan: !!(recipe.vegan || recipe.isVegan),
    glutenFree: !!(recipe.glutenFree || recipe.isGlutenFree),
    popularity: recipe.popularity || 0,
    instructions: formattedInstructions, // Use the processed instructions
    ingredients: formattedIngredients, // Use the processed ingredients
    extendedIngredients: extendedIngredientsParsed, // Keep for raw data if needed elsewhere
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
    owner: recipe.owner || null, // For family recipes
    occasion: recipe.occasion || null, // For family recipes
    notes: recipe.notes || null, // For family recipes
    source: source
  };
}

/**
 * Get recipe details by ID from DB or Spoonacular
 */
async function getRecipeInformation(recipeId, user_id=null) {
  console.log(`Backend: Attempting to get information for recipe ID: ${recipeId}`);
  
  let recipeData = null; // This will hold the final raw recipe data (from DB or Spoonacular)
  let source = null; // To track if it's 'db', 'custom' (which is also 'db'), or 'spoonacular'
  
  // 1. Try to get from 'recipes' table (which includes user's created recipes and family recipes)
  try {
    const rows = await DButils.execQuery("SELECT * FROM recipes WHERE recipe_id = ?", [recipeId]);
    if (rows.length > 0) {
      recipeData = rows[0];
      source = "db";
      console.log(`Backend: Raw DB recipe data for ${recipeId}:`, recipeData);

      // If it's a family recipe, fetch its specific details
      try {
        const familyRows = await DButils.execQuery(
          "SELECT owner, occasion, notes FROM family_recipes WHERE recipe_id = ?",
          [recipeId]
        );
        if (familyRows.length > 0) {
          recipeData.owner = familyRows[0].owner;
          recipeData.occasion = familyRows[0].occasion;
          recipeData.notes = familyRows[0].notes;
          source = "custom"; // Mark as custom if it's a family recipe for better distinction
          console.log(`Backend: Enriched DB recipe data with family info for ${recipeId}:`, recipeData);
        }
      } catch (familyError) {
        console.error(`Backend: Error fetching family recipe info for ${recipeId}:`, familyError);
      }
    }
  } catch (dbError) {
    console.error(`Backend: Error fetching recipe ${recipeId} from DB:`, dbError);
  }

  // If not found in local DB, try Spoonacular
  if (!recipeData) {
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
        recipeData = response.data;
        source = "spoonacular";
      console.log(`Backend: Successfully fetched Spoonacular data for ${recipeId}`);
    } else {
      console.warn(`Backend: No data received from Spoonacular for ${recipeId}`);
    }
  } catch (error) {
    console.error(`Backend: Error fetching recipe ${recipeId} from Spoonacular:`, error.message);
    if (error.response) {
      console.error('Spoonacular API error details:', error.response.data);
    }
      throw { 
        status: 404, 
        message: `Recipe ${recipeId} not found. Spoonacular API error: ${error.message}`
      };
    }
  }

  // If still no recipe data, throw not found
  if (!recipeData) {
    throw {
      status: 404,
      message: `Recipe ${recipeId} not found in local database or Spoonacular.`
    };
    }
    
  // Get popularity (likes count) from favorite_recipes table
  let popularity = 0;
  try {
    const popularityRows = await DButils.execQuery(
      "SELECT COUNT(*) as count FROM favorite_recipes WHERE recipe_id = ?",
      [recipeId]
      );
    if (popularityRows.length > 0) {
      popularity = popularityRows[0].count;
      console.log(`Backend: Popularity for recipe ${recipeId}: ${popularity}`);
    }
  } catch (popularityError) {
    console.error(`Backend: Error fetching popularity for recipe ${recipeId}:`, popularityError);
  }
  recipeData.popularity = popularity; // Add popularity to the raw data
    
    // Add favorite status if user is logged in
    if (user_id) {
    try {
      const favoriteCheck = await DButils.execQuery(
        "SELECT COUNT(*) as count FROM user_favorites WHERE recipe_id = ? AND user_id = ?",
        [recipeId, user_id]
      );
      recipeData.isFavorite = favoriteCheck[0].count > 0 ? 1 : 0;
    } catch (favError) {
      console.error(`Backend: Error checking favorite status for recipe ${recipeId}:`, favError);
      recipeData.isFavorite = 0; // Default to not favorite on error
    }
  } else {
    recipeData.isFavorite = 0; // Default to not favorite if no user_id
  }

  // Transform and return the recipe data
  return transformRecipeData(recipeData, source);
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
    // Validate query parameter
    if (!query || typeof query !== 'string' || query.trim() === '') {
      throw new Error('Search query is required');
    }

    // Ensure query is a string and trim it
    const searchQuery = query.toString().trim();
    
    // Prepare Spoonacular API parameters
    const params = {
      apiKey: SPOONACULAR_API_KEY,
      query: searchQuery,
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

    console.log('Backend: Searching Spoonacular with params:', {
      ...params,
      apiKey: '[REDACTED]' // Don't log the actual API key
    });

    // Make the API call
    const { data } = await axios.get(`${api_domain}/complexSearch`, { params });
    
    if (!data || !data.results) {
      console.error('Backend: Invalid response from Spoonacular:', data);
      return [];
    }

    console.log(`Backend: Found ${data.results.length} results for query "${searchQuery}"`);

    // Transform the results
    const transformedResults = data.results.map(recipe => ({
      ...transformRecipeData(recipe),
      totalResults: data.totalResults,
      offset: data.offset,
      number: data.number
    }));

    return transformedResults;

  } catch (error) {
    console.error('Backend: Error searching recipes:', error.message);
    if (error.response) {
      console.error('Backend: Spoonacular API error:', error.response.data);
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
