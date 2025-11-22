<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'

const connections = ref([])
const dialogVisible = ref(false)
const formRef = ref(null)
const form = ref({
  name: '',
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: '' // Optional default DB
})

const rules = {
  name: [{ required: true, message: 'Please input name', trigger: 'blur' }],
  host: [{ required: true, message: 'Please input host', trigger: 'blur' }],
  user: [{ required: true, message: 'Please input user', trigger: 'blur' }]
}

const API_URL = 'http://localhost:3000/api'

onMounted(() => {
  loadConnections()
})

async function loadConnections() {
  try {
    const res = await axios.get(`${API_URL}/connections`)
    connections.value = res.data
  } catch (error) {
    ElMessage.error('Failed to load connections')
  }
}

function handleAdd() {
  form.value = { name: '', host: 'localhost', port: 3306, user: 'root', password: '', database: '' }
  dialogVisible.value = true
}

function handleEdit(row) {
  form.value = { ...row }
  dialogVisible.value = true
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm('Are you sure to delete this connection?', 'Warning', {
      confirmButtonText: 'OK',
      cancelButtonText: 'Cancel',
      type: 'warning'
    })
    await axios.delete(`${API_URL}/connections/${row.id}`)
    ElMessage.success('Deleted successfully')
    loadConnections()
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('Failed to delete')
  }
}

async function handleTest() {
  try {
    await axios.post(`${API_URL}/test-connection`, form.value)
    ElMessage.success('Connection successful')
  } catch (error) {
    ElMessage.error('Connection failed: ' + (error.response?.data?.error || error.message))
  }
}

async function handleSave() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (valid) {
      try {
        await axios.post(`${API_URL}/connections`, form.value)
        ElMessage.success('Saved successfully')
        dialogVisible.value = false
        loadConnections()
      } catch (error) {
        ElMessage.error('Failed to save')
      }
    }
  })
}
</script>

<template>
  <div class="connection-manager">
    <div class="toolbar">
      <h2>连接管理</h2>
      <el-button type="primary" @click="handleAdd">新建连接</el-button>
    </div>

    <el-table :data="connections" style="width: 100%">
      <el-table-column prop="name" label="连接名" />
      <el-table-column prop="host" label="主机" />
      <el-table-column prop="port" label="端口" width="100" />
      <el-table-column prop="user" label="用户名" />
      <el-table-column label="操作" width="200">
        <template #default="scope">
          <el-button size="small" @click="handleEdit(scope.row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" title="连接详情" width="500px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="连接名" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="主机" prop="host">
          <el-input v-model="form.host" />
        </el-form-item>
        <el-form-item label="端口" prop="port">
          <el-input-number v-model="form.port" />
        </el-form-item>
        <el-form-item label="用户名" prop="user">
          <el-input v-model="form.user" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="handleTest">测试连接</el-button>
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSave">保存</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
</style>
