const { Pool } = require("pg");
require("dotenv").config();

// PostgreSQL configuration - primary database
let pool;
let usingSQLite = false;

// Initialize PostgreSQL connection
const initializeDatabase = async () => {
  try {
    // Prefer a single DATABASE_URL (Neon / Render)
    let connectionOptions;

    if (process.env.DATABASE_URL) {
      console.log("🔗 Using DATABASE_URL for PostgreSQL connection");
      connectionOptions = {
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false, // required for Neon on Render
        },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      };
    } else {
      console.log(
        "🔗 Using individual DB_* env vars for PostgreSQL connection"
      );
      connectionOptions = {
        host: process.env.DB_HOST || "localhost",
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || "safety_routing",
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD || "password",
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        ssl:
          process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
      };
    }

    const pgPool = new Pool(connectionOptions);

    // Test connection
    const client = await pgPool.connect();
    console.log("✅ Connected to PostgreSQL database");
    client.release();

    pool = pgPool;
    usingSQLite = false;
    return true;
  } catch (error) {
    console.error("❌ PostgreSQL connection failed:", error.message);
    console.error(
      "Please ensure PostgreSQL is running and credentials are correct"
    );
    throw error; // fail fast
  }
};

// Initialize on startup
initializeDatabase();

// Unified query interface - Postg
