const sql = require('mssql');

const config = {
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DATABASE,
    options: {
        encrypt: true,
        trustServerCertificate: false
    },
    // CRITICAL: Augmenter les timeouts pour le réveil de la DB
    connectionTimeout: 120000, // 60 secondes au lieu de 15s par défaut
    requestTimeout: 120000,     // 60 secondes pour les requêtes
    pool: {
        idleTimeoutMillis: 30000
    }
};

/**
 * Tente de se connecter à la DB avec retry si elle est en pause
 */
async function connectWithRetry(maxRetries = 2, delayMs = 5000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await sql.connect(config);
            return true;
        } catch (error) {
            // Si c'est un timeout et qu'il reste des tentatives
            if (attempt < maxRetries &&
                (error.code === 'ETIMEOUT' ||
                    error.message.includes('timeout') ||
                    error.message.includes('Failed to connect'))) {

                console.log(`Connection attempt ${attempt} failed, retrying in ${delayMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                continue;
            }
            throw error; // Si dernière tentative ou erreur différente
        }
    }
    return false;
}

module.exports = async function (context, req) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    // Handle preflight
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: headers
        };
        return;
    }

    try {
        const email = req.body?.email;

        // Validation
        if (!email || !email.includes('@')) {
            context.res = {
                status: 400,
                headers: headers,
                body: { success: false, message: 'Invalid email address' }
            };
            return;
        }

        // Connect to database avec retry
        const connected = await connectWithRetry();

        if (!connected) {
            throw new Error('Could not connect to database after retries');
        }

        // Check if email already exists
        const checkResult = await sql.query`
            SELECT 1 FROM Waitlist WHERE email = ${email}
        `;

        if (checkResult.recordset.length > 0) {
            context.res = {
                status: 200,
                headers: headers,
                body: {
                    success: true,
                    message: 'You are already on the waitlist!'
                }
            };
            return;
        }

        // Insert new email
        await sql.query`
            INSERT INTO Waitlist (email, created_at, ip_address, user_agent)
            VALUES (
                ${email}, 
                GETDATE(), 
                ${req.headers['x-forwarded-for'] || req.headers['x-client-ip'] || 'unknown'},
                ${req.headers['user-agent'] || 'unknown'}
            )
        `;

        context.res = {
            status: 200,
            headers: headers,
            body: {
                success: true,
                message: '🎉 Thank you! You\'re on the waitlist. We\'ll be in touch soon.'
            }
        };

    } catch (error) {
        context.log.error('Error:', error);

        // Message différent selon le type d'erreur
        let userMessage = 'An error occurred. Please try again later.';

        if (error.code === 'ETIMEOUT' || error.message.includes('timeout')) {
            userMessage = 'Database is waking up. Please try again in 30 seconds.';
        }

        context.res = {
            status: 500,
            headers: headers,
            body: {
                success: false,
                message: userMessage,
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            }
        };
    } finally {
        try {
            await sql.close();
        } catch (closeError) {
            context.log.error('Error closing connection:', closeError);
        }
    }
}; 
