const { CosmosClient } = require("@azure/cosmos");

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

    // Email validation
    if (!email || !email.includes('@')) {
      context.res = {
        status: 400,
        headers,
        body: { success: false, message: 'Invalid email address' }
      };
      return;
    }

    const id = email.toLowerCase();
    const partitionKey = "waitlist";

    try {
      const { resource } = await container.item(id, partitionKey).read();
      if (resource) {
        context.res = {
          status: 200,
          headers,
          body: { success: true, message: 'You are already on the waitlist!' }
        };
        return;
      }
    } catch (err) {
      if (err.code !== 404) throw err;
    }

    const entity = {
      id,
      partitionKey,
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
