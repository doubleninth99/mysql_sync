/**
 * Generate SQL scripts to synchronize Target to match Source
 * @param {Object} diff - Diff object from comparator
 * @returns {Array} Array of {tableName, sql} objects
 */
function generateSyncSQL(diff) {
    const results = [];

    for (const tableName in diff.tables) {
        const tableDiff = diff.tables[tableName];
        let sql = '';

        if (tableDiff.status === 'NEW') {
            const createSql = tableDiff.source?.createSql;
            if (createSql) {
                sql = createSql;
                if (!sql.endsWith(';')) sql += ';';
            }
        } else if (tableDiff.status === 'DELETED') {
            sql = `DROP TABLE \`${tableName}\`;`;
        } else if (tableDiff.status === 'MODIFIED') {
            const alterSqls = generateAlterTableSQL(tableName, tableDiff.diff, tableDiff.source);
            if (alterSqls.length > 0) {
                sql = `ALTER TABLE \`${tableName}\`\n  ${alterSqls.join(',\n  ')};`;
            }
        }

        if (sql) {
            results.push({ tableName, sql });
        }
    }

    return results;
}

function generateAlterTableSQL(tableName, diff, sourceTable) {
    const alters = [];

    // Columns
    if (diff.columns) {
        for (const colName in diff.columns) {
            const colDiff = diff.columns[colName];
            if (colDiff.status === 'NEW') {
                alters.push(`ADD COLUMN ${formatColumnDefinition(colDiff.source)}`);
            } else if (colDiff.status === 'DELETED') {
                alters.push(`DROP COLUMN \`${colName}\``);
            } else if (colDiff.status === 'MODIFIED') {
                alters.push(`MODIFY COLUMN ${formatColumnDefinition(colDiff.source)}`);
            }
        }
    }

    // Indexes
    // Drop deleted/modified indexes first
    if (diff.indexes) {
        for (const idxName in diff.indexes) {
            const idxDiff = diff.indexes[idxName];
            if (idxDiff.status === 'DELETED' || idxDiff.status === 'MODIFIED') {
                if (idxName === 'PRIMARY') {
                    alters.push(`DROP PRIMARY KEY`);
                } else {
                    alters.push(`DROP INDEX \`${idxName}\``);
                }
            }
        }
        // Add new/modified indexes
        for (const idxName in diff.indexes) {
            const idxDiff = diff.indexes[idxName];
            if (idxDiff.status === 'NEW' || idxDiff.status === 'MODIFIED') {
                if (idxName === 'PRIMARY') {
                    alters.push(`ADD PRIMARY KEY (${formatIndexColumns(idxDiff.source.columns)})`);
                } else {
                    const unique = idxDiff.source.unique ? 'UNIQUE' : '';
                    const type = idxDiff.source.type === 'FULLTEXT' ? 'FULLTEXT' : (idxDiff.source.type === 'SPATIAL' ? 'SPATIAL' : '');
                    alters.push(`ADD ${unique} ${type} INDEX \`${idxName}\` (${formatIndexColumns(idxDiff.source.columns)})`);
                }
            }
        }
    }

    // Foreign Keys
    if (diff.foreignKeys) {
        for (const fkName in diff.foreignKeys) {
            const fkDiff = diff.foreignKeys[fkName];
            if (fkDiff.status === 'DELETED' || fkDiff.status === 'MODIFIED') {
                alters.push(`DROP FOREIGN KEY \`${fkName}\``);
            }
        }
        for (const fkName in diff.foreignKeys) {
            const fkDiff = diff.foreignKeys[fkName];
            if (fkDiff.status === 'NEW' || fkDiff.status === 'MODIFIED') {
                const src = fkDiff.source;
                const cols = src.columns.map(c => `\`${c}\``).join(', ');
                const refCols = src.referencedColumns.map(c => `\`${c}\``).join(', ');
                let sql = `ADD CONSTRAINT \`${fkName}\` FOREIGN KEY (${cols}) REFERENCES \`${src.referencedTable}\` (${refCols})`;
                if (src.updateRule) sql += ` ON UPDATE ${src.updateRule}`;
                if (src.deleteRule) sql += ` ON DELETE ${src.deleteRule}`;
                alters.push(sql);
            }
        }
    }

    // Table Properties (Engine, Comment, Collation)
    if (diff.props) {
        if (diff.props.engine) alters.push(`ENGINE=${diff.props.engine.source}`);
        if (diff.props.comment) alters.push(`COMMENT='${diff.props.comment.source}'`);
        if (diff.props.collation) alters.push(`COLLATE=${diff.props.collation.source}`);
    }

    return alters;
}

function formatColumnDefinition(col) {
    let def = `\`${col.name}\` ${col.fullType}`;

    if (!col.nullable) def += ' NOT NULL';

    if (col.default !== null && col.default !== undefined) {
        if (col.default === 'CURRENT_TIMESTAMP') {
            def += ' DEFAULT CURRENT_TIMESTAMP';
        } else {
            def += ` DEFAULT '${col.default}'`;
        }
    } else if (col.nullable && col.default === null) {
        def += ' DEFAULT NULL';
    }

    if (col.extra) def += ` ${col.extra}`;
    if (col.comment) def += ` COMMENT '${col.comment}'`;

    return def;
}

function formatIndexColumns(cols) {
    return cols.map(c => {
        let part = `\`${c.name}\``;
        if (c.subPart) part += `(${c.subPart})`;
        return part;
    }).join(', ');
}

module.exports = { generateSyncSQL };
