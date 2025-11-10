const sql = require('mssql');

const config = {
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DATABASE,
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

module.exports = async function (context, req) {
    // CORS headers - IMPORTANT!
    const headers = {
        'Access-Control-Allow-Origin': '*', // En production, remplacer * par votre domaine
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    // Handle OPTIONS preflight request
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: headers,
            body: null
        };
        return;
    }

    // Log pour debug
    context.log('Request received:', req.method, req.body);

    try {
        const email = req.body?.email;

        // Validation
        if (!email || !email.includes('@')) {
            context.res = {
                status: 400,
                headers: headers,
                body: { 
                    success: false, 
                    message: 'Invalid email address' 
                }
            };
            return;
        }

        // Connect to database
        context.log('Connecting to database...');
        await sql.connect(config);
        context.log('Database connected');

        // Check if email already exists
        const checkResult = await sql.query`
            SELECT COUNT(*) as count FROM Waitlist WHERE email = ${email}
        `;

        if (checkResult.recordset[0].count > 0) {
            context.log('Email already exists:', email);
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
        context.log('Inserting new email:', email);
        await sql.query`
            INSERT INTO Waitlist (email, created_at, ip_address, user_agent)
            VALUES (
                ${email}, 
                GETDATE(), 
                ${req.headers['x-forwarded-for'] || req.headers['x-client-ip'] || 'unknown'},
                ${req.headers['user-agent'] || 'unknown'}
            )
        `;

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
        context.log.error('Stack:', error.stack);
        
        context.res = {
            status: 500,
            headers: headers,
            body: { 
                success: false, 
                message: 'An error occurred. Please try again later.',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            }
        };
    } finally {
        try {
            await sql.close();
            context.log('Database connection closed');
        } catch (err) {
            context.log.error('Error closing connection:', err);
        }
    }
};