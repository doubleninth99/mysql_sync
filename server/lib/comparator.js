/**
 * Compare two schemas and return differences
 * @param {Object} sourceSchema - Schema from source DB
 * @param {Object} targetSchema - Schema from target DB
 * @returns {Object} Diff object
 */
function compareSchemas(sourceSchema, targetSchema) {
    const diff = {
        tables: {}
    };

    const sourceTables = sourceSchema.tables;
    const targetTables = targetSchema.tables;

    // Check for New and Modified tables
    for (const tableName in sourceTables) {
        if (!targetTables[tableName]) {
            diff.tables[tableName] = { status: 'NEW', source: sourceTables[tableName] };
        } else {
            const tableDiff = compareTables(sourceTables[tableName], targetTables[tableName]);
            if (tableDiff) {
                diff.tables[tableName] = { status: 'MODIFIED', diff: tableDiff, source: sourceTables[tableName], target: targetTables[tableName] };
            } else {
                // diff.tables[tableName] = { status: 'SAME' }; // Optional: include same tables
            }
        }
    }

    // Check for Deleted tables
    for (const tableName in targetTables) {
        if (!sourceTables[tableName]) {
            diff.tables[tableName] = { status: 'DELETED', target: targetTables[tableName] };
        }
    }

    return diff;
}

function compareTables(source, target) {
    const diff = {
        columns: {},
        indexes: {},
        foreignKeys: {},
        props: {}
    };
    let hasChanges = false;

    // Compare Table Properties
    if (source.engine !== target.engine) {
        diff.props.engine = { source: source.engine, target: target.engine };
        hasChanges = true;
    }
    if (source.collation !== target.collation) {
        diff.props.collation = { source: source.collation, target: target.collation };
        hasChanges = true;
    }
    if (source.comment !== target.comment) {
        diff.props.comment = { source: source.comment, target: target.comment };
        hasChanges = true;
    }

    // Compare Columns
    const sourceCols = source.columns;
    const targetCols = target.columns;

    for (const colName in sourceCols) {
        if (!targetCols[colName]) {
            diff.columns[colName] = { status: 'NEW', source: sourceCols[colName] };
            hasChanges = true;
        } else {
            const colDiff = compareColumns(sourceCols[colName], targetCols[colName]);
            if (colDiff) {
                diff.columns[colName] = { status: 'MODIFIED', diff: colDiff, source: sourceCols[colName], target: targetCols[colName] };
                hasChanges = true;
            }
        }
    }
    for (const colName in targetCols) {
        if (!sourceCols[colName]) {
            diff.columns[colName] = { status: 'DELETED', target: targetCols[colName] };
            hasChanges = true;
        }
    }

    // Compare Indexes
    const sourceIdxs = source.indexes;
    const targetIdxs = target.indexes;

    for (const idxName in sourceIdxs) {
        if (!targetIdxs[idxName]) {
            diff.indexes[idxName] = { status: 'NEW', source: sourceIdxs[idxName] };
            hasChanges = true;
        } else {
            const idxDiff = compareIndexes(sourceIdxs[idxName], targetIdxs[idxName]);
            if (idxDiff) {
                diff.indexes[idxName] = { status: 'MODIFIED', diff: idxDiff, source: sourceIdxs[idxName], target: targetIdxs[idxName] };
                hasChanges = true;
            }
        }
    }
    for (const idxName in targetIdxs) {
        if (!sourceIdxs[idxName]) {
            diff.indexes[idxName] = { status: 'DELETED', target: targetIdxs[idxName] };
            hasChanges = true;
        }
    }

    // Compare Foreign Keys
    const sourceFKs = source.foreignKeys;
    const targetFKs = target.foreignKeys;

    for (const fkName in sourceFKs) {
        if (!targetFKs[fkName]) {
            diff.foreignKeys[fkName] = { status: 'NEW', source: sourceFKs[fkName] };
            hasChanges = true;
        } else {
            if (!areFKsEqual(sourceFKs[fkName], targetFKs[fkName])) {
                diff.foreignKeys[fkName] = { status: 'MODIFIED', source: sourceFKs[fkName], target: targetFKs[fkName] };
                hasChanges = true;
            }
        }
    }
    for (const fkName in targetFKs) {
        if (!sourceFKs[fkName]) {
            diff.foreignKeys[fkName] = { status: 'DELETED', target: targetFKs[fkName] };
            hasChanges = true;
        }
    }

    return hasChanges ? diff : null;
}

function compareColumns(source, target) {
    const diff = {};
    let hasChanges = false;

    // Normalize defaults for comparison (e.g. null vs 'NULL')
    // This is a simplification. MySQL defaults can be tricky.

    if (source.fullType !== target.fullType) {
        diff.fullType = { source: source.fullType, target: target.fullType };
        hasChanges = true;
    }
    if (source.nullable !== target.nullable) {
        diff.nullable = { source: source.nullable, target: target.nullable };
        hasChanges = true;
    }
    // Default value comparison is complex, skipping strict check for now or doing simple string check
    if (String(source.default) !== String(target.default)) {
        // Handle null vs "null" string edge cases if needed, but for now strict
        // If both are null (object) or undefined, they match.
        if (source.default !== target.default) {
            diff.default = { source: source.default, target: target.default };
            hasChanges = true;
        }
    }
    if (source.comment !== target.comment) {
        diff.comment = { source: source.comment, target: target.comment };
        hasChanges = true;
    }
    // Extra (auto_increment, on update current_timestamp)
    if (source.extra !== target.extra) {
        diff.extra = { source: source.extra, target: target.extra };
        hasChanges = true;
    }

    return hasChanges ? diff : null;
}

function compareIndexes(source, target) {
    // Compare unique, type, and columns
    if (source.unique !== target.unique) return { unique: { source: source.unique, target: target.unique } };
    if (source.type !== target.type) return { type: { source: source.type, target: target.type } };

    // Compare columns
    if (source.columns.length !== target.columns.length) return { columns: { source: source.columns, target: target.columns } };

    for (let i = 0; i < source.columns.length; i++) {
        if (source.columns[i].name !== target.columns[i].name ||
            source.columns[i].subPart !== target.columns[i].subPart) {
            return { columns: { source: source.columns, target: target.columns } };
        }
    }

    return null;
}

function areFKsEqual(source, target) {
    if (source.referencedTable !== target.referencedTable) return false;
    if (source.updateRule !== target.updateRule) return false;
    if (source.deleteRule !== target.deleteRule) return false;
    if (source.columns.length !== target.columns.length) return false;

    for (let i = 0; i < source.columns.length; i++) {
        if (source.columns[i] !== target.columns[i]) return false;
        if (source.referencedColumns[i] !== target.referencedColumns[i]) return false;
    }

    return true;
}

module.exports = { compareSchemas };
