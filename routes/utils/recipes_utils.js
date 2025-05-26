const axios = require("axios");
const DButils = require("./DButils");
const api_domain = "https://api.spoonacular.com/recipes";
const SPOONACULAR_API_KEY = "9759fc27d4184dd3ae465ec8ef1a9fef";

// Cache duration in seconds (1 hour)
const CACHE_DURATION = 3600;

/**
 * Get recipe information by ID with caching
 */
async function getRecipeInformation(recipe_id) {
    try {
        // Check if it's a custom recipe first
        const customRecipe = await DButils.execQuery(
            `SELECT * FROM recipes 
             WHERE recipe_id = ${recipe_id} 
             AND source = 'custom'`
        );

        if (customRecipe.length > 0) {
            return customRecipe[0];
        }

        // If not a custom recipe, fetch from Spoonacular
        const response = await axios.get(`${api_domain}/${recipe_id}/information`, {
            params: { apiKey: SPOONACULAR_API_KEY }
        });

        return response.data;
    } catch (error) {
        console.error('Error in getRecipeInformation:', error);
        throw error;
    }
}

/**
 * Get analyzed instructions for a recipe
 */
async function getAnalyzedInstructions(recipe_id) {
    try {
        const response = await axios.get(`${api_domain}/${recipe_id}/analyzedInstructions`, {
            params: {
                apiKey: process.env.SPOONACULAR_API_KEY
            }
        });
        return response;
    } catch (error) {
        console.error('Error in getAnalyzedInstructions:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Get full recipe details
 */
async function getRecipeDetails(recipe_id, req) {
    try {
      // First check if it's a custom recipe in our database
      const customRecipe = await DButils.execQuery(
        `SELECT * FROM recipes 
         WHERE recipe_id = ${recipe_id} 
         AND source = 'custom'`
      );
  
      let recipe_info;
      let source = 'spoonacular';
  
      if (customRecipe.length > 0) {
        // Handle custom recipe from database
        recipe_info = customRecipe[0];
        source = 'custom';
      } else {
        // Fetch from Spoonacular
        const response = await axios.get(`${api_domain}/${recipe_id}/information`, {
          params: { apiKey: SPOONACULAR_API_KEY }
        });
        recipe_info = response.data;
      }
  
      // Get user-specific data if user is logged in
      let isViewed = false;
      let isFavorite = false;
      
      // Get the user ID from the session
      const user_id = req?.session?.user_id;
      
      if (user_id) {
        const [viewed, favorited] = await Promise.all([
          DButils.execQuery(
            `SELECT 1 FROM last_watched_recipes 
             WHERE user_id = ${user_id} AND recipe_id = ${recipe_id}`
          ),
          DButils.execQuery(
            `SELECT 1 FROM favorite_recipes 
             WHERE user_id = ${user_id} AND recipe_id = ${recipe_id}`
          )
        ]);
        
        isViewed = viewed.length > 0;
        isFavorite = favorited.length > 0;
      }
  
      // Handle ingredients based on source
      const ingredients = source === 'custom' 
        ? JSON.parse(recipe_info.ingredients)
        : recipe_info.extendedIngredients?.map(ing => ing.original) || [];
  
      // For custom recipes, get family recipe details if they exist
      let familyDetails = null;
      if (source === 'custom') {
        const familyRecipe = await DButils.execQuery(`
          SELECT family_member, occasion 
          FROM family_recipes 
          WHERE created_by = ${recipe_info.user_id} 
          AND family_recipe_id = ${recipe_id}
        `);
        if (familyRecipe.length > 0) {
          familyDetails = familyRecipe[0];
        }
      }
  
      return {
        id: recipe_info.id || recipe_info.recipe_id,
        title: recipe_info.title,
        readyInMinutes: recipe_info.readyInMinutes,
        image: recipe_info.image,
        popularity: recipe_info.aggregateLikes || recipe_info.popularity || 0,
        isVegan: recipe_info.vegan || recipe_info.isVegan || false,
        isVegetarian: recipe_info.vegetarian || recipe_info.isVegetarian || false,
        isGlutenFree: recipe_info.glutenFree || recipe_info.isGlutenFree || false,
        ingredients: ingredients,
        instructions: recipe_info.instructions,
        servings: recipe_info.servings,
        isViewed,
        isFavorite,
        source,
        // Add family recipe details if they exist
        ...(familyDetails && {
          familyMember: familyDetails.family_member,
          occasion: familyDetails.occasion
        })
      };
    } catch (error) {
      console.error('Error in getRecipeDetails:', error);
      throw error;
    }
  }

/**
 * Get preview of multiple recipes with caching
 */
async function getRecipesPreview(recipes_id_array, req) {
    try {
        const recipesPreview = [];
        
        for (const recipe_id of recipes_id_array) {
            try {
                const recipe_preview = await getRecipeDetails(recipe_id, req);
                recipesPreview.push(recipe_preview);
            } catch (error) {
                console.error(`Error getting details for recipe ${recipe_id}:`, error.message);
                // Skip this recipe instead of failing the entire request
            }
        }
        
        return recipesPreview;
    } catch (error) {
        console.error('Error in getRecipesPreview:', error);
        throw error;
    }
}

/**
 * Search recipes with filters
 */
async function search(query, cuisine, diet, intolerance, limit = 5, req) {
    try {
        // Validate limit parameter
        if (![5, 10, 15].includes(parseInt(limit))) {
            throw new Error('Limit parameter must be 5, 10, or 15');
        }

        const searchParams = {
            apiKey: SPOONACULAR_API_KEY,
            query: query,
            number: limit,
            addRecipeInformation: true
        };

        if (cuisine) searchParams.cuisine = cuisine;
        if (diet) searchParams.diet = diet;
        if (intolerance) searchParams.intolerances = intolerance;

        const searchResponse = await axios.get(`${api_domain}/complexSearch`, { 
            params: searchParams
        });

        if (!searchResponse.data.results || searchResponse.data.results.length === 0) {
            return [];
        }

        // Get detailed information for each recipe
        const recipes = await Promise.all(
            searchResponse.data.results.map(async (recipe) => {
                try {
                    const details = await getRecipeDetails(recipe.id, req);
                    return {
                        ...details,
                        isViewed: false,
                        isFavorite: false
                    };
                } catch (error) {
                    console.error(`Error getting details for recipe ${recipe.id}:`, error.message);
                    return null;
                }
            })
        );

        return recipes.filter(recipe => recipe !== null);
    } catch (error) {
        console.error('Error in search:', error);
        throw error;
    }
}

/**
 * Get random recipes
 */
async function getRandomRecipes(req) {
    try {
        const response = await axios.get(`${api_domain}/random`, {
            params: {
                apiKey: SPOONACULAR_API_KEY,
                number: 3,
                addRecipeInformation: true
            }
        });

        if (!response.data.recipes || response.data.recipes.length === 0) {
            return [];
        }

        const recipes = await Promise.all(
            response.data.recipes.map(recipe => getRecipeDetails(recipe.id, req))
        );

        return recipes;
    } catch (error) {
        console.error('Error in getRandomRecipes:', error);
        throw error;
    }
}

/**
 * Add new custom recipe to database
 */
async function addNewRecipe(req) {
    try {
        const user_id = req.session.user_id;
        const { title, readyInMinutes, vegetarian, vegan, glutenFree, servings, instructions, ingredients, image } = req.body;

        // Generate a unique recipe ID for custom recipes
        const timestamp = Date.now();
        const recipe_id = parseInt(`${user_id}${timestamp}`);

        const result = await DButils.execQuery(`
            INSERT INTO recipes (
                recipe_id, user_id, title, image, source,
                readyInMinutes, vegetarian, vegan, glutenFree, 
                servings, instructions, ingredients
            ) VALUES (
                ${recipe_id},
                ${user_id},
                '${title}',
                '${image}',
                'custom',
                ${readyInMinutes},
                ${vegetarian ? 1 : 0},
                ${vegan ? 1 : 0},
                ${glutenFree ? 1 : 0},
                ${servings},
                '${instructions}',
                '${JSON.stringify(ingredients)}'
            )
        `);

        return recipe_id;
    } catch (error) {
        console.error('Error in addNewRecipe:', error.message);
        throw error;
    }
}

module.exports = {
    getRecipeDetails,
    getRecipesPreview,
    search,
    getRandomRecipes,
    addNewRecipe,
    getRecipeInformation
};