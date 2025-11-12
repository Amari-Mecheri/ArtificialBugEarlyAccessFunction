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
    connectionTimeout: 120000, // 120 secondes pour la connexion
    requestTimeout: 120000,    // 120 secondes pour les requêtes
};

/**
 * Tente de se connecter à la DB avec retry si elle est en pause.
 * Elle crée un nouveau pool de connexion par invocation.
 * @returns {sql.ConnectionPool} Le pool de connexion actif.
 * @throws {Error} Si la connexion échoue après toutes les tentatives.
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
            // Si c'est un timeout ou une erreur de connexion et qu'il reste des tentatives
            if (attempt < maxRetries &&
                (error.code === 'ETIMEOUT' ||
                    error.message.includes('timeout') ||
                    error.message.includes('Failed to connect'))) {

                console.log(`Connection attempt ${attempt} failed, retrying in ${delayMs}ms...`);
                // Fermer le pool en échec avant de réessayer
                if (pool) {
                    await pool.close().catch(e => console.error("Error closing pool on retry failure:", e.message));
                }
                await new Promise(resolve => setTimeout(resolve, delayMs));
                continue;
            }
            // Si c'est la dernière tentative ou une erreur différente, fermer et propager
            if (pool) {
                await pool.close().catch(e => console.error("Error closing pool on final failure:", e.message));
            }
            throw error;
        }
    }
    // Cette partie ne devrait pas être atteinte
    throw new Error('Could not connect to database after all retries');
}

module.exports = async function (context, req) {
    let pool = null; // Variable pour stocker le pool de connexion
    
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

        // Validation (point de sortie du Warmup Léger)
        if (!email || !email.includes('@')) {
            context.res = {
                status: 400, // Statut attendu par keepAlive pour le succès du Light Warmup
                headers: headers,
                body: { success: false, message: 'Invalid email address' }
            };
            return; // 🛑 Sortie rapide SANS connexion DB
        }

        // Connect to database avec retry (SEULEMENT si l'e-mail est valide)
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

        // Message différent selon le type d'erreur
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
        // ⚠️ FERMETURE CRITIQUE : Assurer la fermeture du pool pour libérer les vCore.
        if (pool) {
            try {
                await pool.close();
            } catch (closeError) {
                context.log.error('Error closing connection pool:', closeError.message);
            }
        }
    }
};