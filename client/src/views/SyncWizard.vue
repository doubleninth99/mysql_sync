<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import DiffViewer from '../components/DiffViewer.vue'
import SqlHighlight from '../components/SqlHighlight.vue'
import { watch } from 'vue'

const activeStep = ref(0)
const connections = ref([])
const sourceConnId = ref('')
const targetConnId = ref('')
const sourceDb = ref('')
const targetDb = ref('')
const sourceDbs = ref([])
const targetDbs = ref([])

const diffResult = ref(null)
const sqlResult = ref([])
const loading = ref(false)

const API_URL = 'http://localhost:3000/api'

const diffViewerRef = ref(null)

onMounted(() => {
  loadConnections()
  loadSelection()
})

function loadSelection() {
  const saved = localStorage.getItem('mysql-sync-selection')
  if (saved) {
    const data = JSON.parse(saved)
    sourceConnId.value = data.sourceConnId || ''
    targetConnId.value = data.targetConnId || ''
    sourceDb.value = data.sourceDb || ''
    targetDb.value = data.targetDb || ''
    
    if (sourceConnId.value) loadDbs(sourceConnId.value, sourceDbs)
    if (targetConnId.value) loadDbs(targetConnId.value, targetDbs)
  }
}

function saveSelection() {
  localStorage.setItem('mysql-sync-selection', JSON.stringify({
    sourceConnId: sourceConnId.value,
    targetConnId: targetConnId.value,
    sourceDb: sourceDb.value,
    targetDb: targetDb.value
  }))
}

async function loadConnections() {
  try {
    const res = await axios.get(`${API_URL}/connections`)
    connections.value = res.data
  } catch (error) {
    ElMessage.error('Failed to load connections')
  }
}

async function loadDbs(connId, targetRef) {
  if (!connId) return
  const conn = connections.value.find(c => c.id === connId)
  if (!conn) return // Connection might have been deleted
  try {
    const res = await axios.post(`${API_URL}/databases`, conn)
    targetRef.value = res.data
  } catch (error) {
    ElMessage.error('Failed to load databases')
  }
}

function handleSourceChange() {
  sourceDb.value = ''
  loadDbs(sourceConnId.value, sourceDbs)
  saveSelection()
}

function handleTargetChange() {
  targetDb.value = ''
  loadDbs(targetConnId.value, targetDbs)
  saveSelection()
}

// Watch for db changes to save selection
watch([sourceDb, targetDb], () => {
  saveSelection()
})

async function handleCompare() {
  if (!sourceConnId.value || !sourceDb.value || !targetConnId.value || !targetDb.value) {
    ElMessage.warning('请选择源和目标数据库')
    return
  }
  
  saveSelection() // Save on compare too
  loading.value = true
  try {
    const sourceConn = connections.value.find(c => c.id === sourceConnId.value)
    const targetConn = connections.value.find(c => c.id === targetConnId.value)
    
    const res = await axios.post(`${API_URL}/compare`, {
      source: { connection: sourceConn, database: sourceDb.value },
      target: { connection: targetConn, database: targetDb.value }
    })
    
    diffResult.value = res.data.diff
    sqlResult.value = res.data.sql // Array of { tableName, sql }
    activeStep.value = 1
  } catch (error) {
    ElMessage.error('比对失败: ' + (error.response?.data?.error || error.message))
  } finally {
    loading.value = false
  }
}

const selectedTables = ref([])

function handleSelectionChange(selection) {
  selectedTables.value = selection
}

const sqlText = computed(() => {
  if (!sqlResult.value || sqlResult.value.length === 0) {
    return ''
  }
  
  // If no selection, return all SQL
  if (selectedTables.value.length === 0) {
    return sqlResult.value.map(item => item.sql).join('\n\n')
  }
  
  // Filter SQL based on selected tables
  const selectedNames = new Set(selectedTables.value.map(t => t.name))
  const filtered = sqlResult.value.filter(item => selectedNames.has(item.tableName))
  
  return filtered.map(item => item.sql).join('\n\n')
})

function copySql() {
  if (!sqlText.value) {
    ElMessage.warning('没有可复制的 SQL')
    return
  }
  navigator.clipboard.writeText(sqlText.value)
  ElMessage.success('SQL 已复制到剪贴板')
}

function downloadSql() {
  if (!sqlText.value) {
    ElMessage.warning('没有可下载的 SQL')
    return
  }
  
  const blob = new Blob([sqlText.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  
  // Generate filename with timestamp
  const now = new Date()
  const timestamp = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14)
  link.download = `sync_script_${timestamp}.sql`
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="sync-wizard">
    <div class="wizard-header">
      <el-steps :active="activeStep" finish-status="success" align-center>
        <el-step title="选择连接" icon="Connection" />
        <el-step title="比对结果" icon="DocumentChecked" />
        <el-step title="部署脚本" icon="Document" />
      </el-steps>
    </div>

    <!-- Step 0: Selection -->
    <div v-show="activeStep === 0" class="step-content">
      <div class="content-container">
        <div class="connection-selection">
          <div class="conn-box source-box">
            <div class="conn-header">
              <el-icon class="header-icon"><Download /></el-icon>
              <span>源数据库</span>
            </div>
            <el-form label-position="top" class="conn-form">
              <el-form-item label="连接">
                <el-select v-model="sourceConnId" @change="handleSourceChange" placeholder="请选择连接" size="large">
                  <el-option v-for="c in connections" :key="c.id" :label="c.name" :value="c.id" />
                </el-select>
              </el-form-item>
              <el-form-item label="数据库">
                <el-select v-model="sourceDb" placeholder="请选择数据库" size="large">
                  <el-option v-for="db in sourceDbs" :key="db" :label="db" :value="db" />
                </el-select>
              </el-form-item>
            </el-form>
          </div>

          <div class="arrow-divider">
            <el-icon :size="50" class="arrow-icon"><Right /></el-icon>
          </div>

          <div class="conn-box target-box">
            <div class="conn-header">
              <el-icon class="header-icon"><Upload /></el-icon>
              <span>目标数据库</span>
            </div>
             <el-form label-position="top" class="conn-form">
              <el-form-item label="连接">
                <el-select v-model="targetConnId" @change="handleTargetChange" placeholder="请选择连接" size="large">
                  <el-option v-for="c in connections" :key="c.id" :label="c.name" :value="c.id" />
                </el-select>
              </el-form-item>
              <el-form-item label="数据库">
                <el-select v-model="targetDb" placeholder="请选择数据库" size="large">
                  <el-option v-for="db in targetDbs" :key="db" :label="db" :value="db" />
                </el-select>
              </el-form-item>
            </el-form>
          </div>
        </div>
        
        <div class="actions">
          <el-button type="primary" size="large" @click="handleCompare" :loading="loading" class="compare-btn">
            <el-icon class="btn-icon"><Finished /></el-icon>
            开始比对
          </el-button>
        </div>
      </div>
    </div>

    <!-- Step 1: Diff -->
    <div v-show="activeStep === 1" class="step-content full-height">
      <div class="content-container full-height">
        <DiffViewer 
          ref="diffViewerRef"
          :diff="diffResult" 
          :sql="sqlResult" 
          @selection-change="handleSelectionChange"
        />
        <div class="actions-footer">
          <el-button @click="activeStep = 0" size="large">
            <el-icon><Back /></el-icon>
            上一步
          </el-button>
          <el-button type="primary" @click="activeStep = 2" size="large">
            下一步：部署脚本
            <el-icon><Right /></el-icon>
          </el-button>
        </div>
      </div>
    </div>

    <!-- Step 2: SQL -->
    <div v-show="activeStep === 2" class="step-content full-height">
      <div class="content-container full-height">
        <div class="sql-preview">
          <div class="sql-header">
            <el-icon class="sql-icon"><Document /></el-icon>
            <span>SQL 部署脚本</span>
            <el-tag v-if="selectedTables.length > 0" type="info" size="large">
              已选择 {{ selectedTables.length }} 个表
            </el-tag>
            <el-button @click="copySql" type="success" size="small" class="copy-btn-header">
              <el-icon><CopyDocument /></el-icon>
              复制
            </el-button>
            <el-button @click="downloadSql" type="primary" size="small" class="copy-btn-header">
              <el-icon><Download /></el-icon>
              下载
            </el-button>
          </div>
          <div class="sql-code-container">
            <SqlHighlight v-if="sqlText" :code="sqlText" />
            <div v-else class="empty-text">请选择要同步的表</div>
          </div>
        </div>
        <div class="actions-footer">
          <el-button @click="activeStep = 1" size="large">
            <el-icon><Back /></el-icon>
            上一步
          </el-button>
          <div>
            <el-button type="success" @click="copySql" size="large">
              <el-icon><CopyDocument /></el-icon>
              复制 SQL
            </el-button>
            <el-button type="primary" @click="downloadSql" size="large">
              <el-icon><Download /></el-icon>
              下载 SQL
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sync-wizard {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
}

.wizard-header {
  background: white;
  padding: 30px 40px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  margin-bottom: 20px;
}

.step-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: auto;
  padding: 0 20px 20px;
}

.content-container {
  max-width: 1600px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.connection-selection {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 60px 0;
  gap: 60px;
}

.conn-box {
  width: 420px;
  padding: 40px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.conn-box:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
}

.source-box {
  border-color: #67c23a20;
}

.source-box:hover {
  border-color: #67c23a60;
}

.target-box {
  border-color: #409eff20;
}

.target-box:hover {
  border-color: #409eff60;
}

.conn-header {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 30px;
  color: #303133;
  padding-bottom: 20px;
  border-bottom: 2px solid #f0f0f0;
}

.header-icon {
  font-size: 28px;
  color: #409eff;
}

.source-box .header-icon {
  color: #67c23a;
}

.target-box .header-icon {
  color: #409eff;
}

.conn-form :deep(.el-form-item__label) {
  font-weight: 500;
  color: #606266;
  font-size: 15px;
}

.arrow-divider {
  display: flex;
  align-items: center;
}

.arrow-icon {
  color: #409eff;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.1);
    opacity: 1;
  }
}

.actions {
  text-align: center;
  margin-top: 40px;
}

.compare-btn {
  padding: 18px 48px !important;
  font-size: 18px !important;
  font-weight: 600;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
  transition: all 0.3s ease;
}

.compare-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(64, 158, 255, 0.4);
}

.btn-icon {
  margin-right: 8px;
}

.actions-footer {
  padding: 24px;
  text-align: right;
  border-top: 1px solid #e4e7ed;
  background: white;
  display: flex;
  justify-content: space-between;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
}

.actions-footer .el-button {
  transition: all 0.3s ease;
}

.actions-footer .el-button:hover {
  transform: translateX(-2px);
}

.actions-footer .el-button[type="primary"]:hover,
.actions-footer .el-button[type="success"]:hover {
  transform: translateX(2px);
}

.full-height {
  height: calc(100vh - 240px);
}

.full-height .content-container {
  height: 100%;
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  transition: none !important;
}

.sql-preview {
  flex: 1;
  overflow: hidden;
  max-width: 1600px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  background: white;
}

.sql-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 24px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-bottom: 2px solid #e4e7ed;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.sql-icon {
  font-size: 24px;
  color: #67c23a;
}

.sql-header .el-tag {
  margin-left: auto;
}

.copy-btn-header {
  margin-left: 12px;
}

.sql-code-container {
  flex: 1;
  overflow: auto;
  padding: 20px;
  background: #fafafa;
}

.sql-code-container .empty-text {
  padding: 60px 20px;
  text-align: center;
  color: #909399;
  font-size: 15px;
}

:deep(.diff-viewer) {
  width: 100%;
  height: 100%;
}

/* Enhance el-steps */
:deep(.el-steps) {
  padding: 0 20%;
}

:deep(.el-step__title) {
  font-size: 16px;
  font-weight: 600;
}

:deep(.el-step__icon) {
  width: 48px;
  height: 48px;
  font-size: 24px;
}

/* Enhance form elements */
:deep(.el-select) {
  width: 100%;
}

:deep(.el-input__wrapper) {
  border-radius: 8px;
  transition: all 0.3s ease;
}

:deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #409eff40 inset;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px #409eff60 inset;
}
</style>
