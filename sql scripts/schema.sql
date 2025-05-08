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

-- Recipes Table
CREATE TABLE IF NOT EXISTS recipes (
    recipe_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    readyInMinutes INT NOT NULL,
    vegetarian BOOLEAN NOT NULL,
    vegan BOOLEAN NOT NULL,
    glutenFree BOOLEAN NOT NULL,
    servings INT NOT NULL,
    instructions TEXT NOT NULL,
    ingredients JSON NOT NULL,
    image VARCHAR(255) NOT NULL,
    popularity INT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Favorites Table
CREATE TABLE IF NOT EXISTS favorite_recipes (
    user_id INT,
    recipe_id INT,
    favorited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, recipe_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (recipe_id) REFERENCES recipes(recipe_id) ON DELETE CASCADE
);

-- Family Recipes Table
CREATE TABLE IF NOT EXISTS family_recipes (
    family_recipe_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    family_member VARCHAR(100),
    occasion VARCHAR(100),
    ingredients JSON NOT NULL,
    instructions TEXT,
    images JSON,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Last Watched Recipes Table
CREATE TABLE IF NOT EXISTS last_watched (
    user_id INT,
    recipe_id INT,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, recipe_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (recipe_id) REFERENCES recipes(recipe_id) ON DELETE CASCADE
);

-- Meal Plan Table
CREATE TABLE IF NOT EXISTS meal_plan (
    user_id INT,
    recipe_id INT,
    position INT NOT NULL,
    progress DECIMAL(5,2) DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, recipe_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (recipe_id) REFERENCES recipes(recipe_id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_recipes_title ON recipes(title);
CREATE INDEX idx_recipes_popularity ON recipes(popularity DESC);
CREATE INDEX idx_family_recipes_title ON family_recipes(title);