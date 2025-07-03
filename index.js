const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

dotenv.config();

const stripe = require('stripe')(process.env.PAYMENT_GATEWAY_KEY);

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
    const usersCollection = client.db('parcelDB').collection('users')
    const parcelsCollection = client.db('parcelDB').collection('parcels')
    const paymentsCollection = client.db('parcelDB').collection('payments')
    const trackingCollection = client.db('parcelDB').collection('tracking')


    // app.get('/parcels', async (req, res) => {
    //   const parcels = await parcelsCollection.find().toArray();

    //   res.send(parcels)
    // });

    // user post api
    
    app.post('/users', async (req, res) => {
      const email = req.body.email

      const userExists = await usersCollection.findOne({ email })

       const query = { _id: userExists._id };

      if (userExists) {
        // update last log in info
       
        const updateLastLogInInfo = await usersCollection.updateOne(query, {
          $set: {
            last_log_at: new Date().toISOString()
          }
        });


        return res.status(200).send({
          message: 'user already exists',
          inserted: false
        });

      }

      const user = req.body

      const result = await usersCollection.insertOne(user);

      res.send(result)

    })


    // parcels Api by email
    app.get('/parcels', async (req, res) => {
      const userEmail = req.query.email;

      const query = userEmail ? {
        created_by: userEmail
      } : {};

      const options = {
        sort: {
          creation_date: -1
        }
      }

      const parcels = await parcelsCollection.find(query, options).toArray();

      res.send(parcels)

    })

    //parcel api by id 

    app.get('/parcels/:id', async (req, res) => {

      const id = req.params.id;

      const query = { _id: new ObjectId(id) };

      const result = await parcelsCollection.findOne(query);

      res.send(result)

    })

    // 


    // add parcel api 
    app.post('/parcels', async (req, res) => {
      const newParcel = req.body;
      const result = await parcelsCollection.insertOne(newParcel);

      res.send(result)

    })

    // parcel tracking api>>>

    // app.post('/tracking', async (req, res)=>{
    //   const {tracking_id, parcel_id, status, message, updated_by=""} = req.body;

    //   const log = {
    //     tracking_id,
    //     parcel_id: parcel_id ? new ObjectId(parcel_id) : undefined,
    //     status,
    //     time : new Date(),
    //     updated_by,
    //   }

    //   const result = await trackingCollection.insertOne(log);

    //   res.send({success: true, insertedId: result.insertedId})


    // })













    // payment get api 

    app.get('/payments', async (req, res) => {

      try {
        const userEmail = req.query.email;

        // console.log('decocded', req.decoded)
        // if (req.decoded.email !== userEmail) {
        //     return res.status(403).send({ message: 'forbidden access' })
        // }

        const query = userEmail ? { email: userEmail } : {};
        const options = { sort: { paid_at: -1 } }; // Latest first

        const payments = await paymentsCollection.find(query, options).toArray();
        res.send(payments);
      } catch (error) {
        console.error('Error fetching payment history:', error);
        res.status(500).send({ message: 'Failed to get payments' });
      }
    });


    // post record payment and update parcel status

    app.post('/payments', async (req, res) => {

      const { parcelId, email, amount, paymentMethod, transactionId } = req.body;

      const query = { _id: new ObjectId(parcelId) };

      const updateResult = await parcelsCollection.updateOne(query, {
        $set: {
          payment_status: "paid"
        }
      });

      if (updateResult.modifiedCount === 0) {
        return res.status(404).send({ message: 'Parcel not found or already paid' });
      }

      const paymentDoc = {
        parcelId,
        email,
        amount,
        paymentMethod,
        transactionId,
        paid_at_string: new Date().toISOString(),
        paid_at: new Date(),
      }

      const result = await paymentsCollection.insertOne(paymentDoc);

      res.send(result)

    })

    // code from gpt

    // app.post('/payments', async (req, res) => {
    //   try {
    //     const { parcelId, email, amount, paymentMethod, transactionId } = req.body;

    //     if (!ObjectId.isValid(parcelId)) {
    //       return res.status(400).send({ message: "Invalid parcelId" });
    //     }

    //     const query = { _id: new ObjectId(parcelId) };

    //     const updateResult = await parcelsCollection.updateOne(query, {
    //       $set: {
    //         payment_status: "paid"
    //       }
    //     });

    //     if (updateResult.modifiedCount === 0) {
    //       return res.status(404).send({ message: 'Parcel not found or already paid' });
    //     }

    //     const paymentDoc = {
    //       parcelId,
    //       email,
    //       amount,
    //       paymentMethod,
    //       transactionId,
    //       paid_at_string: new Date().toISOString(),
    //       paid_at: new Date(),
    //     };

    //     const result = await paymentCollection.insertOne(paymentDoc);

    //     res.send(result);

    //   } catch (error) {
    //     console.error("Payment error:", error);
    //     res.status(500).send({ message: "Internal Server Error" });
    //   }
    // });



    //parcel delete api 

    app.delete('/parcels/:id', async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };

      const result = await parcelsCollection.deleteOne(query);
      res.send(result);

    })

    app.post('/create-payment-intent', async (req, res) => {

      const amountInCents = req.body.amountInCents
      // console.log(req.body)

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents,
          currency: "usd",
          payment_method_types: ['card'],

        });
        res.json({
          clientSecret: paymentIntent.client_secret
        })

      } catch (error) {
        res.status(500).json({ error: error.message })
        // console.log(error);
      }
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