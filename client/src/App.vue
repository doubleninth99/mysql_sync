<script setup>
</script>

<template>
  <div class="common-layout">
    <el-container>
      <el-header class="header">
        <div class="logo">MySQL 结构同步</div>
        <el-menu mode="horizontal" router :default-active="$route.path">
          <el-menu-item index="/">连接管理</el-menu-item>
          <el-menu-item index="/sync">结构同步</el-menu-item>
        </el-menu>
      </el-header>
      <el-main>
        <router-view></router-view>
      </el-main>
    </el-container>
  </div>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #dcdfe6;
  padding: 0 20px;
}
.logo {
  font-size: 1.2rem;
  font-weight: bold;
  margin-right: 40px;
  color: #409EFF;
}
.el-menu {
  border-bottom: none;
  flex: 1;
}
:deep(.el-main) {
  padding: 0;
  overflow: hidden;
}
</style>
