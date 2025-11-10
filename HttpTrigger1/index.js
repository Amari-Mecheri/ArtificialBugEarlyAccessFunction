const sql = require('mssql');





const config = {
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    server: process.env.SQL_SERVER, // ex: yourserver.database.windows.net
    database: process.env.SQL_DATABASE,
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

module.exports = async function (context, req) {
    // CORS headers
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

        // Connect to database
        await sql.connect(config);

        // Check if email already exists
        const checkResult = await sql.query`
            SELECT COUNT(*) as count FROM Waitlist WHERE email = ${email}
        `;

        if (checkResult.recordset[0].count > 0) {
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

        context.res = {
            status: 500,
            headers: headers,
            body: { 
                success: false, 
                message: 'An error occurred. Please try again later.' 
            }
        };
    } finally {
        await sql.close();
    }
};