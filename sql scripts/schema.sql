CREATE DATABASE mydb
  DEFAULT CHARACTER SET = 'utf8mb4';


-- Users Table
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    country VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recipes Table
CREATE TABLE recipes (
  recipe_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
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
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Favorites Table (Many-to-Many: users <-> recipes)
CREATE TABLE favorite_recipes (
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    recipe_id INT REFERENCES recipes(recipe_id) ON DELETE CASCADE,
    favorited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, recipe_id)
);

-- Family Recipes Table (special recipes)
CREATE TABLE family_recipes (
    family_recipe_id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    family_member VARCHAR(100),
    occasion VARCHAR(100),
    ingredients TEXT[],
    instructions TEXT,
    images TEXT[],
    created_by INT REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Last Watched Recipes Table
CREATE TABLE last_watched (
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    recipe_id INT REFERENCES recipes(recipe_id) ON DELETE CASCADE,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, recipe_id)
);


-- Meal Plan Table
CREATE TABLE meal_plan (
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    recipe_id INT REFERENCES recipes(recipe_id) ON DELETE CASCADE,
    position INT NOT NULL,
    progress NUMERIC(5,2) DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, recipe_id)
);

-- Optional Indexes to optimize search
CREATE INDEX idx_recipes_title ON recipes(title);
CREATE INDEX idx_recipes_popularity ON recipes(popularity DESC);
CREATE INDEX idx_family_recipes_title ON family_recipes(title);