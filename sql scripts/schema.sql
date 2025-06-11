
DROP DATABASE IF EXISTS mydb;
CREATE DATABASE mydb;
USE mydb;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    firstname VARCHAR(50) NOT NULL,
    lastname VARCHAR(50) NOT NULL,
    country VARCHAR(50),
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    profile_pic VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Recipes Table
CREATE TABLE IF NOT EXISTS recipes (
    recipe_id BIGINT PRIMARY KEY,
    user_id INT,
    title VARCHAR(255),
    image TEXT,
    servings INT,
    readyInMinutes INT,
    cookingMinutes INT,
    preparationMinutes INT,
    sourceName VARCHAR(100),
    healthScore FLOAT,
    pricePerServing FLOAT,
    summary TEXT,
    Ingredients TEXT,
    instructions TEXT,
    dishTypes JSON,
    cuisines JSON,
    diets JSON,
    occasions JSON,
    extendedIngredients JSON,
    vegetarian BOOLEAN,
    vegan BOOLEAN,
    glutenFree BOOLEAN,
    sustainable BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- 3. Favorites Table

CREATE TABLE IF NOT EXISTS favorite_recipes (
    user_id INT NOT NULL,
    recipe_id BIGINT NOT NULL,
    favorited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, recipe_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    -- ⚠️ Removed FOREIGN KEY on recipe_id to allow Spoonacular recipes
);
-- 4. Last Watched Recipes Table

CREATE TABLE IF NOT EXISTS last_watched_recipes (
    user_id INT NOT NULL,
    recipe_id BIGINT NOT NULL,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, recipe_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS meal_plans (
  plan_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS meal_plan_recipes (
    plan_id INT NOT NULL,
    recipe_id BIGINT NOT NULL,
    day_of_week VARCHAR(20),
    meal_type VARCHAR(20),
    progress VARCHAR(20) DEFAULT 'Not Started',
    PRIMARY KEY (plan_id, recipe_id),
    FOREIGN KEY (plan_id) REFERENCES meal_plans(plan_id) ON DELETE CASCADE
);



CREATE TABLE IF NOT EXISTS recipe_progress (
    user_id INT NOT NULL,
    recipe_id BIGINT NOT NULL,
    servings INT DEFAULT 1,
    current_step INT DEFAULT 0,
    PRIMARY KEY (user_id, recipe_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE family_recipes (
              family_recipe_id INT NOT NULL AUTO_INCREMENT,
              user_id INT NOT NULL,
              title VARCHAR(255) NOT NULL,
              owner VARCHAR(255) NOT NULL,
              occasion TEXT,
              image TEXT,
              ingredients TEXT,
              instructions TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (family_recipe_id),
              FOREIGN KEY (user_id) REFERENCES users(user_id)
            );