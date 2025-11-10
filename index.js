// -----------------------------
// 🔹 Imports & Configuration
// -----------------------------
const express = require("express");
const cors = require("cors");
require("dotenv").config(); // Load environment variables from .env
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");

const app = express();
const port = process.env.PORT || 3000;

// -----------------------------
// 🔹 Middleware
// -----------------------------
app.use(cors()); // Enable cross-origin requests
app.use(express.json()); // Parse JSON bodies in requests

// -----------------------------
// 🔹 Firebase Admin Initialization
// -----------------------------
// Firebase service key is stored as base64 in environment variable
const decoded = Buffer.from(process.env.FIREBASE_SERVICE_KEY, "base64").toString("utf8");
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Middleware to verify Firebase token in request headers
const verifyFireBaseToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) return res.status(401).send({ message: "Unauthorized access" });

  const token = authorization.split(" ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.token_email = decodedToken.email;
    next();
  } catch (err) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
};

// -----------------------------
// 🔹 MongoDB Setup (Lazy Initialization for Serverless)
// -----------------------------
// In serverless (Vercel), DB connections may not persist across requests.
// We'll connect lazily on the first request and reuse the connection.

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@simplecrudserver.fyfvvbn.mongodb.net/?appName=simpleCRUDserver`;

let cachedClient = null;
let cachedDb = null;
let collections = {}; // Will hold products, bids, users

async function getCollections() {
  if (cachedDb && collections.products && collections.bids && collections.users) {
    // Return already initialized collections
    return collections;
  }

  // Create new MongoDB client if not cached
  if (!cachedClient) {
    const client = new MongoClient(uri, {
      serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
    });
    await client.connect();
    cachedClient = client;
    cachedDb = client.db("smart_db");
    console.log("✅ Connected to MongoDB successfully");
  }

  // Initialize and cache collections
  collections.products = cachedDb.collection("products");
  collections.bids = cachedDb.collection("bids");
  collections.users = cachedDb.collection("users");

  return collections;
}

// -----------------------------
// 🔹 Routes
// -----------------------------

// Root
app.get("/", (req, res) => {
  res.send("🚀 Smart Deals server is running!");
});

// Get all or user-specific products
app.get("/products", verifyFireBaseToken, async (req, res) => {
  try {
    const { products } = await getCollections();
    const email = req.query.email;
    const query = email ? { email } : {};
    const result = await products.find(query).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

// Get latest 6 products
app.get("/latest-products", async (req, res) => {
  try {
    const { products } = await getCollections();
    const result = await products
      .find()
      .sort({ created_at: -1 })
      .limit(6)
      .toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

// Get single product by ID
app.get("/products/:id", async (req, res) => {
  try {
    const { products } = await getCollections();
    const result = await products.findOne({ _id: new ObjectId(req.params.id) });
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

// Add new product
app.post("/products", verifyFireBaseToken, async (req, res) => {
  try {
    const { products } = await getCollections();
    const result = await products.insertOne(req.body);
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

// Update product
app.patch("/products/:id", async (req, res) => {
  try {
    const { products } = await getCollections();
    const update = { $set: req.body };
    const result = await products.updateOne({ _id: new ObjectId(req.params.id) }, update);
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

// Delete single product
app.delete("/products/:id", async (req, res) => {
  try {
    const { products } = await getCollections();
    const result = await products.deleteOne({ _id: new ObjectId(req.params.id) });
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

// Delete all products
app.delete("/products", async (req, res) => {
  try {
    const { products } = await getCollections();
    const result = await products.deleteMany({});
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

// -----------------------------
// Bids Routes
// -----------------------------

// Get all bids or filter by buyer email
app.get("/bids", verifyFireBaseToken, async (req, res) => {
  try {
    const { bids } = await getCollections();
    const email = req.query.email;
    const query = email ? { buyer_email: email } : {};

    if (email && email !== req.token_email) {
      return res.status(403).send({ message: "Forbidden access" });
    }

    const result = await bids.find(query).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

// Get bids for a specific product
app.get("/products/bids/:productId", async (req, res) => {
  try {
    const { bids } = await getCollections();
    const result = await bids
      .find({ product: req.params.productId })
      .sort({ bid_price: -1 })
      .toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

// Add new bid
app.post("/bids", async (req, res) => {
  try {
    const { bids } = await getCollections();
    const result = await bids.insertOne(req.body);
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

// Delete bid by ID
app.delete("/bids/:id", async (req, res) => {
  try {
    const { bids } = await getCollections();
    const result = await bids.deleteOne({ _id: new ObjectId(req.params.id) });
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

// -----------------------------
// Users Routes
// -----------------------------

app.post("/users", async (req, res) => {
  try {
    const { users } = await getCollections();
    const email = req.body.email;

    const existingUser = await users.findOne({ email });
    if (existingUser) return res.send("User already exists.");

    const result = await users.insertOne(req.body);
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

// -----------------------------
// Global Error Handler
// -----------------------------
app.use((err, req, res, next) => {
  console.error("❌ Internal error:", err.stack);
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
  });
});

// -----------------------------
// Start Server
// -----------------------------
app.listen(port, () => {
  console.log(`✅ Smart Deals server running on port ${port}`);
});
