<script setup>
import { computed, ref, onMounted, nextTick, watch } from 'vue'
import SqlHighlight from './SqlHighlight.vue'

const props = defineProps({
  diff: {
    type: Object,
    required: true
  },
  sql: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['selection-change'])

const selectedTable = ref(null)
const tableRef = ref(null)

const tableList = computed(() => {
  if (!props.diff || !props.diff.tables) return []
  return Object.keys(props.diff.tables).map(name => {
    const t = props.diff.tables[name]
    return {
      name,
      status: t.status,
      sourceName: t.status === 'DELETED' ? '' : name,
      targetName: t.status === 'NEW' ? '' : name,
      ...t
    }
  })
})

// Auto-select rows when diff changes
watch(() => props.diff, () => {
  nextTick(() => {
    if (tableRef.value) {
      tableList.value.forEach(row => {
        // Select all by default, or maybe just changed ones? 
        // Usually we want to sync everything that is different.
        // Since we only show diffs (mostly), we select all.
        // Wait, tableList includes all tables? No, compareSchemas returns all?
        // My comparator returns all if I uncommented the 'SAME' part, but currently it returns only changes?
        // Let's check comparator.js. It returns only changes if I recall correctly.
        // "return hasChanges ? diff : null;"
        // And inside compareSchemas: "if (tableDiff) ... else { // diff.tables[tableName] = { status: 'SAME' }; }"
        // So tableList only contains changed tables. So select all.
        tableRef.value.toggleRowSelection(row, true)
      })
    }
  })
}, { immediate: true })

const selectedSql = computed(() => {
  if (!selectedTable.value) return ''
  const tableName = selectedTable.value.name
  const item = props.sql.find(s => s.tableName === tableName)
  return item ? item.sql : ''
})

const ddlDiff = computed(() => {
  if (!selectedTable.value) return null
  const t = selectedTable.value
  return {
    source: t.source?.createSql || '',
    target: t.target?.createSql || ''
  }
})

function handleRowClick(row) {
  selectedTable.value = row
}

function handleSelectionChange(selection) {
  emit('selection-change', selection)
}

function getOperationIcon(status) {
  switch (status) {
    case 'NEW': return 'Plus'
    case 'DELETED': return 'Close'
    case 'MODIFIED': return 'Edit'
    default: return 'Minus'
  }
}

function getOperationColor(status) {
  switch (status) {
    case 'NEW': return '#67C23A'
    case 'DELETED': return '#F56C6C'
    case 'MODIFIED': return '#E6A23C'
    default: return '#909399'
  }
}
</script>

<template>
  <div class="diff-viewer">
    <!-- Table List -->
    <div class="table-list">
      <el-table 
        ref="tableRef"
        :data="tableList" 
        style="width: 100%; height: 100%" 
        height="100%"
        highlight-current-row
        @row-click="handleRowClick"
        @selection-change="handleSelectionChange"
        border
      >
        <el-table-column type="selection" width="55" />
        <el-table-column label="源对象" prop="sourceName">
          <template #default="{ row }">
            <div class="table-cell">
              <el-icon v-if="row.sourceName"><Document /></el-icon>
              <span style="margin-left: 5px">{{ row.sourceName }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" align="center">
          <template #default="{ row }">
            <el-icon :size="20" :color="getOperationColor(row.status)">
              <component :is="getOperationIcon(row.status)" />
            </el-icon>
          </template>
        </el-table-column>
        <el-table-column label="目标对象" prop="targetName">
          <template #default="{ row }">
            <div class="table-cell">
              <el-icon v-if="row.targetName"><Document /></el-icon>
              <span style="margin-left: 5px">{{ row.targetName }}</span>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- DDL Preview -->
    <div class="ddl-preview">
      <el-tabs type="border-card" class="preview-tabs">
        <el-tab-pane label="部署脚本">
          <div class="code-content">
            <SqlHighlight v-if="selectedSql" :code="selectedSql" />
            <div v-else class="empty-text">无变更或未选择表</div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="DDL 比较">
           <div class="ddl-diff-container" v-if="ddlDiff">
             <div class="ddl-pane">
               <div class="pane-header">源 DDL</div>
               <SqlHighlight :code="ddlDiff.source" />
             </div>
             <div class="ddl-pane">
               <div class="pane-header">目标 DDL</div>
               <SqlHighlight :code="ddlDiff.target" />
             </div>
           </div>
           <div v-else class="empty-text">请选择一个表查看 DDL</div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<style scoped>
.diff-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid #e4e7ed;
  max-width: 1600px;
  margin: 0 auto;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
}

.table-list {
  flex: 1;
  overflow: hidden;
  background: white;
}

.ddl-preview {
  height: 320px;
  border-top: 2px solid #e4e7ed;
  background: #fafafa;
}

.preview-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
}

:deep(.el-tabs__content) {
  flex: 1;
  overflow: auto;
  padding: 0 !important;
}

:deep(.el-tabs__header) {
  margin: 0;
  background: white;
  padding: 12px 16px 0;
}

:deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background-color: #e4e7ed;
}

:deep(.el-tabs__item) {
  font-weight: 500;
  font-size: 14px;
}

:deep(.el-table) {
  font-size: 14px;
}

:deep(.el-table th) {
  background: #f5f7fa;
  color: #606266;
  font-weight: 600;
}

:deep(.el-table tr:hover) {
  background: #f0f9ff;
}

:deep(.el-table__row) {
  cursor: pointer;
  transition: all 0.2s ease;
}

:deep(.el-table__row.current-row) {
  background: #ecf5ff;
}

.code-content {
  padding: 20px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  white-space: pre-wrap;
  font-size: 13px;
  line-height: 1.6;
  color: #2c3e50;
  background: white;
}

.code-content pre {
  margin: 0;
  color: #2c3e50;
}

.empty-text {
  padding: 40px;
  color: #909399;
  text-align: center;
  font-size: 14px;
}

.table-cell {
  display: flex;
  align-items: center;
  font-weight: 500;
}

.table-cell .el-icon {
  color: #909399;
  margin-right: 6px;
}

.ddl-diff-container {
  display: flex;
  height: 100%;
  background: white;
}

.ddl-pane {
  flex: 1;
  padding: 16px;
  border-right: 1px solid #e4e7ed;
  overflow: auto;
  display: flex;
  flex-direction: column;
  background: #fafafa;
}

.ddl-pane:last-child {
  border-right: none;
}

.pane-header {
  font-weight: 600;
  margin-bottom: 12px;
  color: #303133;
  border-bottom: 2px solid #409eff;
  padding-bottom: 8px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.ddl-pane pre {
  margin: 0;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  white-space: pre-wrap;
  font-size: 12px;
  color: #2c3e50;
  background: white;
  padding: 12px;
  border-radius: 4px;
  line-height: 1.5;
}
</style>
