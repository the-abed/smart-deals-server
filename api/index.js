const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");

const app = express();

// Initialize Firebase Admin only once
let firebaseInitialized = false;
try {
  if (!firebaseInitialized && process.env.FIREBASE_SERVICE_KEY) {
    const decoded = Buffer.from(
      process.env.FIREBASE_SERVICE_KEY,
      "base64"
    ).toString("utf8");
    const serviceAccount = JSON.parse(decoded);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    firebaseInitialized = true;
    console.log('Firebase initialized successfully');
  }
} catch (error) {
  console.error('Firebase initialization error:', error);
}

// middleware
app.use(cors());
app.use(express.json());

const verifyFireBaseToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.token_email = decoded.email;
    next();
  } catch (error) {
    console.error('Firebase token verification error:', error);
    return res.status(401).send({ message: "unauthorized access" });
  }
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@simplecrudserver.fyfvvbn.mongodb.net/?appName=simpleCRUDserver`;

// Database connection caching for serverless environment
let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  try {
    await client.connect();
    const db = client.db("smart_db");
    
    cachedClient = client;
    cachedDb = db;
    
    return { client, db };
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

// Configuration check endpoint
app.get("/api/test-config", (req, res) => {
  const config = {
    hasFirebaseKey: !!process.env.FIREBASE_SERVICE_KEY,
    hasDbUser: !!process.env.DB_USER,
    hasDbPass: !!process.env.DB_PASS,
    firebaseInitialized: firebaseInitialized
  };
  res.json(config);
});

// API Routes
app.get("/api/products", verifyFireBaseToken, async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const productsCollection = db.collection("products");
    
    const email = req.query.email;
    const query = email ? { email } : {};
    const result = await productsCollection.find(query).toArray();
    res.json(result);
  } catch (error) {
    console.error('Error in /api/products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get("/api/latest-products", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const productsCollection = db.collection("products");
    
    const result = await productsCollection
      .find()
      .sort({ created_at: -1 })
      .limit(6)
      .toArray();
    res.json(result);
  } catch (error) {
    console.error('Error in /api/latest-products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post("/api/products", verifyFireBaseToken, async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const productsCollection = db.collection("products");
    
    const newProduct = {
      ...req.body,
      created_at: new Date()
    };
    const result = await productsCollection.insertOne(newProduct);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error in POST /api/products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get("/api/bids", verifyFireBaseToken, async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const bidsCollection = db.collection("bids");
    
    const email = req.query.email;
    const query = {};
    if (email) {
      query.buyer_email = email;
      if (email !== req.token_email) {
        return res.status(403).json({ message: "forbidden access" });
      }
    }
    const result = await bidsCollection.find(query).toArray();
    res.json(result);
  } catch (error) {
    console.error('Error in /api/bids:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection("users");
    
    const { email } = req.body;
    const existingUser = await usersCollection.findOne({ email });

    if (existingUser) {
      return res.json({ message: "User already exists" });
    }
    
    const result = await usersCollection.insertOne({
      ...req.body,
      created_at: new Date()
    });
    res.status(201).json(result);
  } catch (error) {
    console.error('Error in POST /api/users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export the Express API
module.exports = app;