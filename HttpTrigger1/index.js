// index.js - VERSION DE TEST SIMPLE
// Remplacez temporairement votre code par celui-ci pour identifier le problème

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
        context.log('OPTIONS request');
        context.res = {
            status: 200,
            headers: headers
        };
        return;
    }

    try {
        context.log('Body received:', JSON.stringify(req.body));
        
        const email = req.body?.email;
        
        if (!email) {
            context.log('No email provided');
            context.res = {
                status: 400,
                headers: headers,
                body: { success: false, message: 'Email required' }
            };
            return;
        }

        context.log('Email received:', email);
        
        // TEST SANS SQL - juste pour vérifier que ça marche
        context.res = {
            status: 200,
            headers: headers,
            body: { 
                success: true, 
                message: '🎉 Test réussi! Email: ' + email 
            }
        };
        
    } catch (error) {
        context.log.error('Error:', error.message);
        context.res = {
            status: 500,
            headers: headers,
            body: { 
                success: false, 
                message: 'Error: ' + error.message 
            }
        };
    }
};