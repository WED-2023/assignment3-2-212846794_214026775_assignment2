USE mydb;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    country VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recipes Table (Handles both Spoonacular and custom recipes)
CREATE TABLE IF NOT EXISTS recipes (
    recipe_id BIGINT PRIMARY KEY,
    user_id INT,
    title VARCHAR(150) NOT NULL,
    image VARCHAR(255) NOT NULL,
    popularity INT DEFAULT 0,
    source ENUM('spoonacular', 'custom') NOT NULL,
    -- Custom recipe specific fields
    readyInMinutes INT,
    vegetarian BOOLEAN,
    vegan BOOLEAN,
    glutenFree BOOLEAN,
    servings INT,
    instructions TEXT,
    ingredients JSON,
    -- Cache management for Spoonacular recipes
    cache_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_popularity (popularity DESC),
    INDEX idx_cache_timestamp (cache_timestamp),
    INDEX idx_source (source)
);

-- Favorites Table
CREATE TABLE IF NOT EXISTS favorite_recipes (
    user_id INT,
    recipe_id BIGINT,
    favorited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, recipe_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (recipe_id) REFERENCES recipes(recipe_id) ON DELETE CASCADE
);

-- Family Recipes Table
CREATE TABLE IF NOT EXISTS family_recipes (
    family_recipe_id INT AUTO_INCREMENT PRIMARY KEY,
    created_by INT,
    title VARCHAR(100) NOT NULL,
    family_member VARCHAR(100),
    occasion VARCHAR(100),
    ingredients JSON NOT NULL,
    instructions TEXT,
    images JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Last Watched Recipes Table
CREATE TABLE IF NOT EXISTS last_watched_recipes (
    user_id INT,
    recipe_id BIGINT,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, recipe_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (recipe_id) REFERENCES recipes(recipe_id) ON DELETE CASCADE
);

-- Meal Plan Table
CREATE TABLE IF NOT EXISTS meal_plan (
    user_id INT,
    recipe_id BIGINT,
    position INT NOT NULL,
    progress DECIMAL(5,2) DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, recipe_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (recipe_id) REFERENCES recipes(recipe_id) ON DELETE CASCADE
);

-- Indexes
DROP PROCEDURE IF EXISTS create_index_if_not_exists;

DELIMITER //
CREATE PROCEDURE create_index_if_not_exists()
BEGIN
    -- Check and create index for recipes.title
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.statistics 
        WHERE table_schema = 'mydb' 
        AND table_name = 'recipes' 
        AND index_name = 'idx_recipes_title'
    ) THEN
        CREATE INDEX idx_recipes_title ON recipes(title);
    END IF;

    -- Check and create index for recipes.popularity
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.statistics 
        WHERE table_schema = 'mydb' 
        AND table_name = 'recipes' 
        AND index_name = 'idx_recipes_popularity'
    ) THEN
        CREATE INDEX idx_recipes_popularity ON recipes(popularity DESC);
    END IF;

    -- Check and create index for family_recipes.title
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.statistics 
        WHERE table_schema = 'mydb' 
        AND table_name = 'family_recipes' 
        AND index_name = 'idx_family_recipes_title'
    ) THEN
        CREATE INDEX idx_family_recipes_title ON family_recipes(title);
    END IF;
END //
DELIMITER ;

CALL create_index_if_not_exists();
DROP PROCEDURE create_index_if_not_exists;