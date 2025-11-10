const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

const admin = require("firebase-admin");

const serviceAccount = require("./smart-deals-e8695-firebase-admin-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// middleware
app.use(cors()); // allow cross-origin requests
app.use(express.json()); // parse JSON bodies

const verifyFireBaseToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    console.log("inside token", decoded);
    req.token_email = decoded.email;
    next();
  } catch (error) {
    return res.status(401).send({ message: "unauthorized access" });
  }
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@simplecrudserver.fyfvvbn.mongodb.net/?appName=simpleCRUDserver`;

// Create MongoDB client with options
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("Smart Deals server running !");
});

async function run() {
  try {
    await client.connect(); // connect to MongoDB

    // create database and collection references
    const db = client.db("smart_db");
    const productsCollection = db.collection("products");
    const bidsCollection = db.collection("bids");
    const usersCollection = db.collection("users");

    // get all products or filter by email
    app.get("/products", verifyFireBaseToken, async (req, res) => {
      console.log(req.query);
      const email = req.query.email;
      const query = {};
      if (email) {
        query.email = email;
      }
      const cursor = productsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // get latest 6 products
    app.get("/latest-products", async (req, res) => {
      const cursor = productsCollection
        .find()
        .sort({ created_at: -1 })
        .limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    // get single product by id (string id, not ObjectId)
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id; // get id from URL
      const query = { _id: id }; // match _id as string
      const result = await productsCollection.findOne(query);
      res.send(result);
    });

    // add a new product
    app.post("/products", verifyFireBaseToken, async (req, res) => {
      console.log("headers", req.headers);
      const newProduct = req.body;
      const result = await productsCollection.insertOne(newProduct);
      res.send(result);
    });

    // update a product (this expects _id as ObjectId)
    app.patch("/products/:id", async (req, res) => {
      const id = req.params.id;
      const updatedProduct = req.body;
      const query = { _id: new ObjectId(id) }; // convert id to ObjectId
      const update = {
        $set: {
          name: updatedProduct.name,
          price: updatedProduct.price,
        },
      };
      const result = await productsCollection.updateOne(query, update);
      res.send(result);
    });

    // delete one product by ObjectId
    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.deleteOne(query);
      res.send(result);
    });

    // delete all products
    app.delete("/products", async (req, res) => {
      const result = await productsCollection.deleteMany({});
      res.send(result);
    });

    // get all bids or filter by buyer email
    app.get("/bids", verifyFireBaseToken, async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.buyer_email = email;
        if (email !== req.token_email) {
          return res.status(403).send({ message: "forbidden access" });
        }
      }
      const cursor = bidsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/products/bids/:productId", async (req, res) => {
      const productId = req.params.productId;
      const query = { product: productId };
      const cursor = bidsCollection.find(query).sort({ bid_price: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    // add a new bid
    app.post("/bids", async (req, res) => {
      const newBid = req.body;

      const result = await bidsCollection.insertOne(newBid);

      res.send(result);
    });

    // delete a bid by ObjectId
    app.delete("/bids/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bidsCollection.deleteOne(query);
      res.send(result);
    });

    // add user only if not exists
    app.post("/users", async (req, res) => {
      const newUser = req.body;
      const email = req.body.email;
      const query = { email: email };
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        res.send("user already exist. do not need to insert again");
      } else {
        const result = await usersCollection.insertOne(newUser);
        res.send(result);
      }
    });

    // test connection
    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB successfully!");
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Smart Deals server listening on port ${port}`);
});

// another way to connect to MongoDB
// client.connect()
//   .then(() => {
//     app.listen(port, () => {
//       console.log(`Smart Deals server listening on port ${port}`)
//     })
//   })
//   .catch(console.dir)
