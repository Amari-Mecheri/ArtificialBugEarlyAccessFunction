const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");

const account = process.env.AZURE_STORAGE_ACCOUNT;
const accountKey = process.env.AZURE_STORAGE_KEY;
const tableName = "waitList";

const credential = new AzureNamedKeyCredential(account, accountKey);
const client = new TableClient(
  `https://${account}.table.core.windows.net`,
  tableName,
  credential
);

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

    const partitionKey = "waitlist";
    const rowKey = email.toLowerCase();

    // Check if email already exists
    try {
      await client.getEntity(partitionKey, rowKey);
      context.res = {
        status: 200,
        headers,
        body: { success: true, message: 'You are already on the waitlist!' }
      };
      return;
    } catch (err) {
      if (err.statusCode !== 404) throw err; // Error other than "not found"
    }

    // Add new email to the waitlist
    const entity = {
      partitionKey,
      rowKey,
      createdAt: new Date().toISOString(),
      ipAddress: req.headers['x-forwarded-for'] || req.headers['x-client-ip'] || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown'
    };

    await client.createEntity(entity);

    context.res = {
      status: 200,
      headers,
      body: { success: true, message: '🎉 Thank you! You\'re on the waitlist. We\'ll be in touch soon.' }
    };

  } catch (error) {
    context.log.error('Error:', error);
    context.res = {
      status: 500,
      headers,
      body: { success: false, message: 'An error occurred. Please try again later.' }
    };
  }
};
