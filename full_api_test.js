const axios = require('axios');
require('dotenv').config();

const baseURL = 'http://localhost:3000/api';
let sessionCookie = '';

async function main() {
    try {
        // // 1. Register a new user
        // console.log('\n1. Registering new user...');
        // const registerRes = await axios.post(`${baseURL}/auth/register`, {
        //     username: 'testuser3',
        //     firstName: 'Test',
        //     lastName: 'User',
        //     country: 'Israel',
        //     email: 'test3@example.com',
        //     password: 'Passw0rd!',
        //     passwordConfirmation: 'Passw0rd!'
        // });
        // console.log('Registration response:', registerRes.status);

        // 2. Login
        console.log('\n2. Logging in...');
        const loginRes = await axios.post(`${baseURL}/auth/login`, {
            username: 'testuser3',
            password: 'Passw0rd!'
        });
        sessionCookie = loginRes.headers['set-cookie'][0];
        console.log('Login response:', loginRes.status);
        console.log('Session cookie:', sessionCookie);
        console.log('Logged in as:', loginRes.data.username);

        // 3. Create a new recipe
        console.log('\n3. Creating new recipe...');
        const newRecipe = await axios.post(`${baseURL}/recipes`, {
            title: 'Test Recipe',
            readyInMinutes: 30,
            vegetarian: true,
            vegan: false,
            glutenFree: true,
            servings: 4,
            instructions: 'Test instructions',
            ingredients: ['ingredient1', 'ingredient2'],
            image: 'https://example.com/image.jpg'
        }, {
            headers: { Cookie: sessionCookie }
        });
        console.log('New recipe created:', newRecipe.data);
        const localRecipeId = newRecipe.data.id;
        console.log('Local recipe ID:', localRecipeId);

        // 4. Search for recipes
        console.log('\n4. Searching for recipes...');
        let spoonacularRecipeId;
        try {
            const searchResponse = await axios.get(
                `${baseURL}/recipes/search?query=pasta&number=5&cuisine=italian&diet=vegetarian&intolerances=gluten&instructionsRequired=true&addRecipeInformation=true&fillIngredients=true`,
                {
                    headers: {
                        Cookie: sessionCookie
                    }
                }
            );
            console.log("Search response:", searchResponse.data);
            spoonacularRecipeId = searchResponse.data[0].id;
        } catch (error) {
            console.error("Error in search:", error.response?.data);
            // Use a default recipe ID if search fails
            spoonacularRecipeId = 716429; // A known pasta recipe ID
            console.log('Using default recipe ID:', spoonacularRecipeId);
        }
        console.log('Using Spoonacular recipe ID:', spoonacularRecipeId);

        // 5. Get user recipes
        console.log('\n5. Getting user recipes...');
        const userRecipes = await axios.get(`${baseURL}/users/testuser3/recipes`, {
            headers: { Cookie: sessionCookie }
        });
        console.log('User recipes:', userRecipes.data.map(r => r.title));

        // 6. Add to favorites (both local and Spoonacular recipes)
        console.log('\n6. Adding to favorites...');
        try {
            // Add local recipe to favorites
            const addLocalFavorite = await axios.post(`${baseURL}/users/testuser3/favorites`, {
                recipeId: localRecipeId
            }, {
                headers: { Cookie: sessionCookie }
            });
            console.log('Add local recipe to favorites response:', addLocalFavorite.status);

            // Add Spoonacular recipe to favorites
            const addSpoonacularFavorite = await axios.post(`${baseURL}/users/testuser3/favorites`, {
                recipeId: spoonacularRecipeId
            }, {
                headers: { Cookie: sessionCookie }
            });
            console.log('Add Spoonacular recipe to favorites response:', addSpoonacularFavorite.status);
        } catch (err) {
            console.log('API error:', err.response?.status, err.response?.data);
        }

        // 7. Get favorites
        console.log('\n7. Getting favorites...');
        const getFavRes = await axios.get(`${baseURL}/users/testuser3/favorites`, {
            headers: { Cookie: sessionCookie }
        });
        console.log('Favorites full response:', getFavRes.data);
        console.log('Favorites:', getFavRes.data.map(r => r.title));

        // 8. Add to last watched (both local and Spoonacular recipes)
        console.log('\n8. Adding to last watched...');
        try {
            console.log('Adding to last watched - recipeId:', localRecipeId);
            // Add local recipe to last watched
            const addLocalWatched = await axios.post(`${baseURL}/users/lastWatchedRecipes`, {
                recipeId: String(localRecipeId)
            }, {
                headers: { Cookie: sessionCookie }
            });
            console.log('Add local recipe to last watched response:', addLocalWatched.status);
            
            // Add Spoonacular recipe to last watched
            const addSpoonacularWatched = await axios.post(`${baseURL}/users/lastWatchedRecipes`, {
                recipeId: String(spoonacularRecipeId)
            }, {
                headers: { Cookie: sessionCookie }
            });
            console.log('Add Spoonacular recipe to last watched response:', addSpoonacularWatched.status);
            
            // Add a 1-second delay
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err) {
            console.log('API error:', err.response?.status, err.response?.data);
        }

        // 9. Get last watched
        console.log('\n9. Getting last watched...');
        const getLastWatchedRes = await axios.get(`${baseURL}/users/lastWatchedRecipes`, {
            headers: { Cookie: sessionCookie }
        });
        console.log('Last watched full response:', getLastWatchedRes.data);
        console.log('Last watched response:', getLastWatchedRes.data);
        console.log('Last watched:', getLastWatchedRes.data.map(r => r.title));

        // 10. Add to meal plan
        console.log('\n10. Adding to meal plan...');
        try {
            const addMealPlan = await axios.post(`${baseURL}/meal-plan`, {
                recipeId: spoonacularRecipeId,
                position: 1
            }, {
                headers: { Cookie: sessionCookie }
            });
            console.log('Add to meal plan response:', addMealPlan.status);
        } catch (err) {
            console.log('API error:', err.response?.status, err.response?.data);
        }

        // 11. Get meal plan
        console.log('\n11. Getting meal plan...');
        const getMealPlanRes = await axios.get(`${baseURL}/meal-plan`, {
            headers: { Cookie: sessionCookie }
        });
        console.log('Meal plan:', getMealPlanRes.data);

        // 12. Add family recipe
        console.log('\n12. Adding family recipe...');
        const addFamilyRecipe = await axios.post(`${baseURL}/users/testuser3/family-recipes`, {
            title: 'Grandmas Special Pasta',
            owner: 'Grandma Sarah',
            whenToPrepare: 'Sunday Dinner',
            readyInMinutes: 45,
            vegetarian: true,
            vegan: false,
            glutenFree: false,
            image: 'https://example.com/pasta.jpg',
            instructions: '1. Boil pasta. 2. Make sauce. 3. Combine and serve',
            ingredients: ['pasta', 'tomato sauce', 'cheese', 'herbs']
        }, {
            headers: { Cookie: sessionCookie }
        });
        console.log('Add family recipe response:', addFamilyRecipe.status);

        // 13. Get family recipes
        console.log('\n13. Getting family recipes...');
        const getFamilyRecipesRes = await axios.get(`${baseURL}/users/testuser3/family-recipes`, {
            headers: { Cookie: sessionCookie }
        });
        console.log('Family recipes:', getFamilyRecipesRes.data);

        // 14. Logout
        console.log('\n14. Logging out...');
        const logoutRes = await axios.post(`${baseURL}/auth/logout`, {}, {
            headers: { Cookie: sessionCookie }
        });
        console.log('Logout response:', logoutRes.status);

    } catch (error) {
        console.error('Error in main:', error.response?.data || error.message);
    }
}

main();