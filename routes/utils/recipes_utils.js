const axios = require("axios");
const DButils = require("./DButils");
const api_domain = "https://api.spoonacular.com/recipes";
const SPOONACULAR_API_KEY = process.env.SPOONACULAR_API_KEY;

// Cache duration in seconds (1 hour)
const CACHE_DURATION = 3600;

/**
 * Get recipe information by ID with caching
 */
async function getRecipeInformation(recipe_id) {
    try {
        // First check if it's a custom recipe
        const customRecipe = await DButils.execQuery(
            `SELECT * FROM recipes 
             WHERE recipe_id = ${recipe_id} 
             AND source = 'custom'`
        );

        if (customRecipe.length > 0) {
            console.log('Found custom recipe:', recipe_id);
            return customRecipe[0];
        }

        // Check if recipe exists in cache and is not expired
        const cachedRecipe = await DButils.execQuery(
            `SELECT * FROM recipes 
             WHERE recipe_id = ${recipe_id} 
             AND source = 'spoonacular'
             AND cache_timestamp > DATE_SUB(NOW(), INTERVAL ${CACHE_DURATION} SECOND)`
        );

        if (cachedRecipe.length > 0) {
            console.log('Recipe found in cache:', recipe_id);
            return cachedRecipe[0];
        }

        // If not in cache or expired, fetch from API
        console.log('Fetching recipe from Spoonacular:', recipe_id);
        const response = await axios.get(`${api_domain}/${recipe_id}/information`, {
            params: { apiKey: SPOONACULAR_API_KEY }
        });

        const recipeData = response.data;
        
        // Update or insert into cache
        await DButils.execQuery(`
            INSERT INTO recipes (
                recipe_id, title, image, popularity, source, 
                readyInMinutes, vegetarian, vegan, glutenFree, 
                servings, instructions, ingredients, cache_timestamp
            )
            VALUES (
                ${recipe_id}, 
                '${recipeData.title}', 
                '${recipeData.image}', 
                ${recipeData.aggregateLikes || 0},
                'spoonacular',
                ${recipeData.readyInMinutes || null},
                ${recipeData.vegetarian ? 1 : 0},
                ${recipeData.vegan ? 1 : 0},
                ${recipeData.glutenFree ? 1 : 0},
                ${recipeData.servings || null},
                '${recipeData.instructions || ''}',
                '${JSON.stringify(recipeData.extendedIngredients || [])}',
                NOW()
            )
            ON DUPLICATE KEY UPDATE 
                title = VALUES(title),
                image = VALUES(image),
                popularity = VALUES(popularity),
                readyInMinutes = VALUES(readyInMinutes),
                vegetarian = VALUES(vegetarian),
                vegan = VALUES(vegan),
                glutenFree = VALUES(glutenFree),
                servings = VALUES(servings),
                instructions = VALUES(instructions),
                ingredients = VALUES(ingredients),
                cache_timestamp = NOW()
        `);

        return recipeData;
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
 * Get full recipe details with caching
 */
async function getRecipeDetails(recipe_id) {
    try {
        const recipe_info = await getRecipeInformation(recipe_id);
        
        // Get user-specific data if user is logged in
        let isViewed = false;
        let isFavorite = false;
        
        if (recipe_info.user_id) {
            const [viewed, favorited] = await Promise.all([
                DButils.execQuery(
                    `SELECT 1 FROM last_watched_recipes 
                     WHERE user_id = ${recipe_info.user_id} AND recipe_id = ${recipe_id}`
                ),
                DButils.execQuery(
                    `SELECT 1 FROM favorite_recipes 
                     WHERE user_id = ${recipe_info.user_id} AND recipe_id = ${recipe_id}`
                )
            ]);
            
            isViewed = viewed.length > 0;
            isFavorite = favorited.length > 0;
        }

        // Handle both custom and Spoonacular recipes
        const ingredients = recipe_info.source === 'custom' 
            ? JSON.parse(recipe_info.ingredients)
            : recipe_info.extendedIngredients?.map(ing => ing.original) || [];

        return {
            id: recipe_info.id,
            title: recipe_info.title,
            readyInMinutes: recipe_info.readyInMinutes,
            image: recipe_info.image,
            popularity: recipe_info.popularity || 0,
            isVegan: recipe_info.vegan,
            isVegetarian: recipe_info.vegetarian,
            isGlutenFree: recipe_info.glutenFree,
            ingredients: ingredients,
            instructions: recipe_info.instructions,
            servings: recipe_info.servings,
            isViewed,
            isFavorite,
            source: recipe_info.source
        };
    } catch (error) {
        console.error('Error in getRecipeDetails:', error);
        throw error;
    }
}

/**
 * Get preview of multiple recipes with caching
 */
async function getRecipesPreview(recipes_id_array) {
    try {
        const recipesPreview = [];
        
        for (const recipe_id of recipes_id_array) {
            try {
                const recipe_preview = await getRecipeDetails(recipe_id);
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
async function search(query, cuisine, diet, intolerance, limit = 5) {
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
                    const details = await getRecipeDetails(recipe.id);
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
async function getRandomRecipes() {
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
            response.data.recipes.map(recipe => getRecipeDetails(recipe.id))
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