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
    connectionTimeout: 120000, 
    requestTimeout: 120000,    
    
    // NOUVEAU: Configuration agressive du Pool pour forcer la fermeture rapide
    pool: {
        // Conserver les connexions inactives pendant seulement 5 secondes
        idleTimeoutMillis: 5000 
    }
};

/**
 * Tente de se connecter à la DB avec retry si elle est en pause.
 * Elle crée un nouveau pool de connexion par invocation.
 */
async function connectWithRetry(maxRetries = 2, delayMs = 5000) {
    let pool;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // CRÉER ET CONNECTER UN NOUVEAU POOL pour cette invocation
            pool = new sql.ConnectionPool(config);
            await pool.connect();
            return pool; // Retourne le pool connecté
        } catch (error) {
            // Logique de retry et de fermeture de pool en cas d'échec
            if (attempt < maxRetries &&
                (error.code === 'ETIMEOUT' ||
                    error.message.includes('timeout') ||
                    error.message.includes('Failed to connect'))) {

                console.log(`Connection attempt ${attempt} failed, retrying in ${delayMs}ms...`);
                if (pool) {
                    await pool.close().catch(e => console.error("Error closing pool on retry failure:", e.message));
                }
                await new Promise(resolve => setTimeout(resolve, delayMs));
                continue;
            }
            if (pool) {
                await pool.close().catch(e => console.error("Error closing pool on final failure:", e.message));
            }
            throw error;
        }
    }
    throw new Error('Could not connect to database after all retries');
}

module.exports = async function (context, req) {
    let pool = null; 
    
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (req.method === 'OPTIONS') {
        context.res = { status: 200, headers: headers };
        return;
    }

    try {
        const email = req.body?.email;

        // Validation (point de sortie du Warmup Léger)
        if (!email || !email.includes('@')) {
            context.res = {
                status: 400, // Statut attendu par keepAlive
                headers: headers,
                body: { success: false, message: 'Invalid email address' }
            };
            return; // 🛑 Sortie rapide SANS connexion DB
        }

        // Connecter au pool SEULEMENT si l'e-mail est valide
        pool = await connectWithRetry(); 

        // Check if email already exists
        const checkResult = await pool.request().query`
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
        await pool.request().query`
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

        let userMessage = 'An error occurred. Please try again later.';

        if (error.code === 'ETIMEOUT' || error.message.includes('timeout') || error.message.includes('Failed to connect')) {
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
        // ⚠️ FERMETURE CRITIQUE : Assurer la fermeture du pool
        if (pool) {
            try {
                await pool.close();
            } catch (closeError) {
                context.log.error('Error closing connection pool:', closeError.message);
            }
        }
    }
};