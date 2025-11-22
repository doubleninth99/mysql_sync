/**
 * Load schema information from the database
 * @param {Object} connection - MySQL connection
 * @param {string} database - Database name
 * @returns {Promise<Object>} Schema definition
 */
async function getSchema(connection, database) {
    const schema = {
        tables: {}
    };

    // 1. Get Tables
    const [tables] = await connection.execute(
        `SELECT TABLE_NAME, ENGINE, TABLE_COLLATION, TABLE_COMMENT 
         FROM information_schema.TABLES 
         WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`,
        [database]
    );

    for (const table of tables) {
        // Fetch Create Table Statement
        let createSql = '';
        try {
            const [createResult] = await connection.execute(`SHOW CREATE TABLE \`${table.TABLE_NAME}\``);
            createSql = createResult[0]['Create Table'];
        } catch (e) {
            console.warn(`Failed to get CREATE TABLE for ${table.TABLE_NAME}`, e);
        }

        schema.tables[table.TABLE_NAME] = {
            name: table.TABLE_NAME,
            engine: table.ENGINE,
            collation: table.TABLE_COLLATION,
            comment: table.TABLE_COMMENT,
            createSql: createSql,
            columns: {},
            indexes: {},
            foreignKeys: {}
        };
    }

    // 2. Get Columns
    const [columns] = await connection.execute(
        `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_DEFAULT, IS_NULLABLE, DATA_TYPE, 
                CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE, 
                COLUMN_TYPE, COLUMN_KEY, EXTRA, COLUMN_COMMENT, COLLATION_NAME
         FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = ? 
         ORDER BY TABLE_NAME, ORDINAL_POSITION`,
        [database]
    );

    for (const col of columns) {
        if (schema.tables[col.TABLE_NAME]) {
            schema.tables[col.TABLE_NAME].columns[col.COLUMN_NAME] = {
                name: col.COLUMN_NAME,
                type: col.DATA_TYPE,
                fullType: col.COLUMN_TYPE,
                nullable: col.IS_NULLABLE === 'YES',
                default: col.COLUMN_DEFAULT,
                key: col.COLUMN_KEY,
                extra: col.EXTRA,
                comment: col.COLUMN_COMMENT,
                collation: col.COLLATION_NAME,
                length: col.CHARACTER_MAXIMUM_LENGTH,
                precision: col.NUMERIC_PRECISION,
                scale: col.NUMERIC_SCALE
            };
        }
    }

    // 3. Get Indexes
    const [indexes] = await connection.execute(
        `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME, 
                COLLATION, SUB_PART, INDEX_TYPE, COMMENT, INDEX_COMMENT
         FROM information_schema.STATISTICS 
         WHERE TABLE_SCHEMA = ?
         ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
        [database]
    );

    for (const idx of indexes) {
        if (schema.tables[idx.TABLE_NAME]) {
            const tableName = idx.TABLE_NAME;
            const indexName = idx.INDEX_NAME;

            if (!schema.tables[tableName].indexes[indexName]) {
                schema.tables[tableName].indexes[indexName] = {
                    name: indexName,
                    unique: idx.NON_UNIQUE === 0,
                    type: idx.INDEX_TYPE,
                    comment: idx.INDEX_COMMENT || idx.COMMENT,
                    columns: []
                };
            }

            schema.tables[tableName].indexes[indexName].columns.push({
                name: idx.COLUMN_NAME,
                seq: idx.SEQ_IN_INDEX,
                subPart: idx.SUB_PART
            });
        }
    }

    // 4. Get Foreign Keys
    // We use KEY_COLUMN_USAGE for columns and REFERENTIAL_CONSTRAINTS for rules
    const [fks] = await connection.execute(
        `SELECT k.TABLE_NAME, k.CONSTRAINT_NAME, k.COLUMN_NAME, 
                k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME,
                r.UPDATE_RULE, r.DELETE_RULE
         FROM information_schema.KEY_COLUMN_USAGE k
         JOIN information_schema.REFERENTIAL_CONSTRAINTS r 
           ON k.CONSTRAINT_NAME = r.CONSTRAINT_NAME 
           AND k.CONSTRAINT_SCHEMA = r.CONSTRAINT_SCHEMA
         WHERE k.TABLE_SCHEMA = ? AND k.REFERENCED_TABLE_NAME IS NOT NULL
         ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION`,
        [database]
    );

    for (const fk of fks) {
        if (schema.tables[fk.TABLE_NAME]) {
            const tableName = fk.TABLE_NAME;
            const fkName = fk.CONSTRAINT_NAME;

            if (!schema.tables[tableName].foreignKeys[fkName]) {
                schema.tables[tableName].foreignKeys[fkName] = {
                    name: fkName,
                    table: tableName,
                    referencedTable: fk.REFERENCED_TABLE_NAME,
                    updateRule: fk.UPDATE_RULE,
                    deleteRule: fk.DELETE_RULE,
                    columns: [], // local columns
                    referencedColumns: [] // remote columns
                };
            }

            schema.tables[tableName].foreignKeys[fkName].columns.push(fk.COLUMN_NAME);
            schema.tables[tableName].foreignKeys[fkName].referencedColumns.push(fk.REFERENCED_COLUMN_NAME);
        }
    }

    return schema;
}

module.exports = { getSchema };
