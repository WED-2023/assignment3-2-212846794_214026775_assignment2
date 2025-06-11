require("dotenv").config();
const MySql = require("./MySql");

async function execQuery(query, params = []) {
  let returnValue = [];
  const connection = await MySql.connection();
  try {
    await connection.query("START TRANSACTION");
    returnValue = await connection.query(query, params);
    await connection.query("COMMIT");
    console.log("Transaction committed successfully");
  } catch (err) {
    await connection.query("ROLLBACK");
    console.error("ROLLBACK on execQuery:", err);
    throw err;
  } finally {
    await connection.release();
  }
  return returnValue;
}

async function createTables() {
  try {
    await execQuery(`
      CREATE TABLE IF NOT EXISTS users (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        firstname VARCHAR(50) NOT NULL,
        lastname VARCHAR(50) NOT NULL,
        country VARCHAR(100) NOT NULL,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        profile_pic VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await execQuery(`
      CREATE TABLE IF NOT EXISTS recipes (
        recipe_id BIGINT PRIMARY KEY,
        user_id INT,
        title VARCHAR(255),
        image VARCHAR(255),
        imageType VARCHAR(10),
        servings INT,
        readyInMinutes INT,
        cookingMinutes INT,
        preparationMinutes INT,
        license VARCHAR(100),
        sourceName VARCHAR(100),
        sourceUrl TEXT,
        spoonacularSourceUrl TEXT,
        healthScore FLOAT,
        spoonacularScore FLOAT,
        pricePerServing FLOAT,
        summary TEXT,
        instructions TEXT,
        dishTypes JSON,
        cuisines JSON,
        diets JSON,
        occasions JSON,
        winePairing JSON,
        extendedIngredients JSON,
        vegetarian BOOLEAN,
        vegan BOOLEAN,
        glutenFree BOOLEAN,
        dairyFree BOOLEAN,
        ketogenic BOOLEAN,
        whole30 BOOLEAN,
        veryHealthy BOOLEAN,
        veryPopular BOOLEAN,
        cheap BOOLEAN,
        sustainable BOOLEAN,
        weightWatcherSmartPoints INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
      );
    `);

    await execQuery(`
      CREATE TABLE IF NOT EXISTS favorite_recipes (
        user_id INT NOT NULL,
        recipe_id BIGINT NOT NULL,
        favorited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, recipe_id),
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (recipe_id) REFERENCES recipes(recipe_id) ON DELETE CASCADE
      );
    `);

    await execQuery(`
      CREATE TABLE IF NOT EXISTS last_watched_recipes (
        user_id INT NOT NULL,
        recipe_id BIGINT NOT NULL,
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, recipe_id),
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (recipe_id) REFERENCES recipes(recipe_id) ON DELETE CASCADE
      );
    `);

    await execQuery(`
      CREATE TABLE IF NOT EXISTS family_recipes (
        family_recipe_id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        family_member VARCHAR(100),
        occasion VARCHAR(100),
        ingredients JSON,
        instructions TEXT,
        images JSON,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE
      );
    `);

    await execQuery(`
      CREATE TABLE IF NOT EXISTS meal_plan (
        user_id INT NOT NULL,
        recipe_id BIGINT NOT NULL,
        day_of_week VARCHAR(20),
        meal_type VARCHAR(20),
        progress VARCHAR(20) DEFAULT 'Not Started',
        PRIMARY KEY (user_id, recipe_id),
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (recipe_id) REFERENCES recipes(recipe_id) ON DELETE CASCADE
      );
    `);

    await execQuery(`
      CREATE TABLE IF NOT EXISTS recipe_progress (
          user_id INT NOT NULL,
          recipe_id BIGINT NOT NULL,
          servings INT DEFAULT 1,
          current_step INT DEFAULT 0,
          PRIMARY KEY (user_id, recipe_id),
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
          FOREIGN KEY (recipe_id) REFERENCES recipes(recipe_id) ON DELETE CASCADE
      )
    `);
    

    console.log("✅ All tables created successfully");
  } catch (error) {
    console.error("❌ Failed to create tables:", error);
    throw error;
  }
}

// Run once on start
createTables().catch((err) => {
  console.error("DB init failed:", err);
});

module.exports = {
  execQuery,
  createTables
};
