const { CosmosClient } = require("@azure/cosmos");
const { v4: uuidv4 } = require('uuid');

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = "ArtificialBugDB";
const containerId = "waitList";

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

module.exports = async function (context, req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    context.res = { status: 200, headers };
    return;
  }

  try {
    const email = req.body?.email;

    if (!email || !email.includes('@')) {
      context.res = {
        status: 400,
        headers,
        body: { success: false, message: 'Invalid email address' }
      };
      return;
    }

    const partitionKey = "waitlist";

    const querySpec = {
      query: "SELECT VALUE COUNT(1) FROM c WHERE c.email = @email",
      parameters: [{ name: "@email", value: email }]
    };

    const { resources: counts } = await container.items.query(querySpec, { partitionKey }).fetchAll();
    const count = counts[0] || 0;

    if (count > 0) {
      context.res = {
        status: 200,
        headers,
        body: { success: true, message: 'You are already on the waitlist!' }
      };
      return;
    }

    const entity = {
      id: uuidv4(),
      partitionKey,
      email,
      createdAt: new Date().toISOString(),
      ipAddress: req.headers['x-forwarded-for'] || req.headers['x-client-ip'] || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      status: 'pending'
    };

    await container.items.create(entity);

    context.res = {
      status: 200,
      headers,
      body: { success: true, message: '🎉 Thank you! You\'re on the waitlist. We\'ll be in touch soon.' }
    };

  } catch (error) {
    context.error('Error:', error);
    context.res = {
      status: 500,
      headers,
      body: { success: false, message: 'An error occurred. Please try again later.' }
    };
  }
};
