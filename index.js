const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

// smartdbUser
//a7sV0FMAsckdsz2B

const uri =
  "mongodb+srv://smartdbUser:a7sV0FMAsckdsz2B@simplecrudserver.fyfvvbn.mongodb.net/?appName=simpleCRUDserver";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Smart Deals server running !");
});

async function run() {
  try {
    await client.connect();

    const db = client.db('smart_db');
    const productsCollection = db.collection('products');

    app.get('/products', async (req, res) => {
      const cursor = productsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get( '/products/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id)};
      const result = await productsCollection.findOne(query);
      res.send(result);
    })

    app.post('/products', async (req, res) => {
      const newProduct = req.body;
      const result = await productsCollection.insertOne(newProduct);
      res.send(result);
    })

    app.patch('/products/:id', async (req, res) => {
      const id = req.params.id;
      const updatedProduct = req.body;
      const query = { _id: new ObjectId(id)};
      const update = {
        $set: {
          name: updatedProduct.name,
          price: updatedProduct.price
        }
      }
      const result = await productsCollection.updateOne(query,update);
      res.send(result);
    })

    app.delete('/products/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.deleteOne(query);
      res.send(result);

    })

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Smart Deals server listening on this port ${port}`);
});

// Another way to connect to MongoDB

// client.connect()
// .then(() =>{
//     app.listen(port, () => {
//     console.log(`Smart Deals server listening on this port ${port}`)
// })
// })
// .catch(console.dir)
