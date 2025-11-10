// index.js - VERSION FINALE AVEC SQL
const sql = require('mssql');

const config = {
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DATABASE,
    options: {
        encrypt: true,
        trustServerCertificate: false,
        connectTimeout: 30000
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

module.exports = async function (context, req) {
    context.log('Function started');
    
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    // Handle OPTIONS
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: headers
        };
        return;
    }

    let pool;
    
    try {
        const email = req.body?.email;
        
        // Validation email
        if (!email || !email.includes('@')) {
            context.res = {
                status: 400,
                headers: headers,
                body: { success: false, message: 'Invalid email address' }
            };
            return;
        }

        context.log('Email received:', email);
        
        // Log config (sans mot de passe)
        context.log('SQL Config:', {
            user: config.user,
            server: config.server,
            database: config.database
        });

        // Connexion à la base de données
        context.log('Connecting to database...');
        pool = await sql.connect(config);
        context.log('Database connected successfully');

        // Vérifier si l'email existe déjà
        context.log('Checking if email exists...');
        const checkResult = await pool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT COUNT(*) as count FROM Waitlist WHERE email = @email');

        if (checkResult.recordset[0].count > 0) {
            context.log('Email already exists');
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

        // Insérer le nouvel email
        context.log('Inserting new email...');
        const ip = req.headers['x-forwarded-for'] || req.headers['x-client-ip'] || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';
        
        await pool.request()
            .input('email', sql.NVarChar, email)
            .input('ip', sql.NVarChar, ip)
            .input('userAgent', sql.NVarChar, userAgent)
            .query('INSERT INTO Waitlist (email, ip_address, user_agent) VALUES (@email, @ip, @userAgent)');

        context.log('Email inserted successfully');
        
        context.res = {
            status: 200,
            headers: headers,
            body: { 
                success: true, 
                message: '🎉 Thank you! You\'re on the waitlist. We\'ll be in touch soon.' 
            }
        };

    } catch (error) {
        context.log.error('Error occurred:', error.message);
        context.log.error('Error code:', error.code);
        context.log.error('Stack:', error.stack);
        
        let errorMessage = 'An error occurred. Please try again later.';
        
        // Messages d'erreur plus précis
        if (error.code === 'ELOGIN') {
            errorMessage = 'Database authentication failed';
        } else if (error.code === 'ETIMEOUT') {
            errorMessage = 'Database connection timeout';
        } else if (error.code === 'EREQUEST') {
            errorMessage = 'Database query error';
        }
        
        context.res = {
            status: 500,
            headers: headers,
            body: { 
                success: false, 
                message: errorMessage,
                debug: {
                    error: error.message,
                    code: error.code
                }
            }
        };
    } finally {
        if (pool) {
            try {
                await pool.close();
                context.log('Database connection closed');
            } catch (err) {
                context.log.error('Error closing connection:', err.message);
            }
        }
    }
};