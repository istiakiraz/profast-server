const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion } = require('mongodb');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.un5m5dm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    //collection
    const parcelsCollection = client.db('parcelDB').collection('parcels')


    app.get('/parcels', async (req, res) => {
      const parcels = await parcelsCollection.find().toArray();

      res.send(parcels)
    });

    // parcels Api by email
    app.get('/parcels', async (req, res) => {
      const userEmail = req.query.email;

      const query = userEmail ? { created_by: userEmail } : {};

      const options = {
        sort: {
          creation_date: -1
        }
      }

      const parcels = await parcelsCollection.find(query, options).toArray();

      res.send(parcels)

    })




    app.post('/parcels', async (req, res) => {
      const newParcel = req.body;
      const result = await parcelsCollection.insertOne(newParcel);

      res.send(result)

    })







    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);








// sample route
app.get('/', (req, res) => {
  res.send('Porfast Server is running')
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
})