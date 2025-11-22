const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

const { createConnection, testConnection } = require('./lib/db');
const { getSchema } = require('./lib/schema-loader');
const { compareSchemas } = require('./lib/comparator');
const { generateSyncSQL } = require('./lib/sql-generator');

const CONNECTIONS_FILE = path.join(__dirname, 'connections.json');
if (!fs.existsSync(CONNECTIONS_FILE)) {
    fs.writeFileSync(CONNECTIONS_FILE, '[]');
}

// Helper to read/write connections
function getConnections() {
    return JSON.parse(fs.readFileSync(CONNECTIONS_FILE, 'utf8'));
}

function saveConnections(connections) {
    fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(connections, null, 2));
}

// Routes

// Get all connections
app.get('/api/connections', (req, res) => {
    const connections = getConnections();
    // Don't send passwords back to UI if possible, but for this MVP we might need them 
    // or we just send them and be careful. The user asked for "save connections", 
    // usually we mask password in UI but need it for connection.
    // For simplicity, we send it.
    res.json(connections);
});

// Add/Update connection
app.post('/api/connections', (req, res) => {
    const connections = getConnections();
    const newConn = req.body;

    if (newConn.id) {
        const index = connections.findIndex(c => c.id === newConn.id);
        if (index !== -1) {
            connections[index] = newConn;
        } else {
            connections.push(newConn);
        }
    } else {
        newConn.id = Date.now().toString();
        connections.push(newConn);
    }

    saveConnections(connections);
    res.json(newConn);
});

// Delete connection
app.delete('/api/connections/:id', (req, res) => {
    let connections = getConnections();
    connections = connections.filter(c => c.id !== req.params.id);
    saveConnections(connections);
    res.json({ success: true });
});

// Test Connection
app.post('/api/test-connection', async (req, res) => {
    try {
        await testConnection(req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// List Databases
app.post('/api/databases', async (req, res) => {
    let connection;
    try {
        connection = await createConnection(req.body);
        const [rows] = await connection.execute('SHOW DATABASES');
        const databases = rows.map(row => row.Database).filter(db =>
            !['information_schema', 'mysql', 'performance_schema', 'sys'].includes(db)
        );
        res.json(databases);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) await connection.end();
    }
});

// Compare Schemas
app.post('/api/compare', async (req, res) => {
    const { source, target } = req.body;
    // source and target are objects: { connection: {...}, database: 'dbname' }

    let sourceConn, targetConn;
    try {
        // Override the database in the connection config with the selected one
        const sourceConfig = { ...source.connection, database: source.database };
        const targetConfig = { ...target.connection, database: target.database };

        sourceConn = await createConnection(sourceConfig);
        targetConn = await createConnection(targetConfig);

        const sourceSchema = await getSchema(sourceConn, source.database);
        const targetSchema = await getSchema(targetConn, target.database);

        const diff = compareSchemas(sourceSchema, targetSchema);
        const sql = generateSyncSQL(diff);

        res.json({
            diff,
            sql
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (sourceConn) await sourceConn.end();
        if (targetConn) await targetConn.end();
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
