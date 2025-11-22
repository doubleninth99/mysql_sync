const mysql = require('mysql2/promise');

/**
 * Create a connection to the database
 * @param {Object} config - Database configuration
 * @returns {Promise<mysql.Connection>}
 */
async function createConnection(config) {
    return await mysql.createConnection({
        host: config.host,
        port: config.port || 3306,
        user: config.user,
        password: config.password,
        database: config.database,
        // Allow multiple statements for SQL generation scripts if needed, 
        // though usually we execute them one by one or let the user do it.
        multipleStatements: true
    });
}

/**
 * Test a connection
 * @param {Object} config 
 * @returns {Promise<boolean>}
 */
async function testConnection(config) {
    let connection;
    try {
        connection = await createConnection(config);
        await connection.ping();
        return true;
    } catch (error) {
        throw error;
    } finally {
        if (connection) await connection.end();
    }
}

module.exports = {
    createConnection,
    testConnection
};
