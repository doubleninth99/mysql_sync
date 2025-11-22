<script setup>
import { computed } from 'vue'

const props = defineProps({
  code: {
    type: String,
    required: true
  }
})

const highlightedCode = computed(() => {
  if (!props.code) return ''
  
  let result = props.code
  
  // SQL 关键词
  const keywords = [
    'CREATE', 'TABLE', 'ALTER', 'DROP', 'ADD', 'MODIFY', 'COLUMN', 'INDEX',
    'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'CONSTRAINT', 'UNIQUE',
    'NOT', 'NULL', 'DEFAULT', 'AUTO_INCREMENT', 'ON', 'UPDATE', 'DELETE',
    'CASCADE', 'SET', 'RESTRICT', 'NO', 'ACTION', 'COMMENT', 'ENGINE',
    'COLLATE', 'CHARACTER', 'CHARSET', 'INT', 'VARCHAR', 'TEXT', 'DATETIME',
    'TIMESTAMP', 'BIGINT', 'TINYINT', 'DECIMAL', 'CURRENT_TIMESTAMP'
  ]
  
  // 高亮关键词
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
    result = result.replace(regex, `<span class="sql-keyword">${keyword}</span>`)
  })
  
  // 高亮字符串
  result = result.replace(/'([^']*)'/g, '<span class="sql-string">\'$1\'</span>')
  
  // 高亮数字
  result = result.replace(/\b(\d+)\b/g, '<span class="sql-number">$1</span>')
  
  // 高亮表名和字段名（反引号）
  result = result.replace(/`([^`]+)`/g, '<span class="sql-identifier">`$1`</span>')
  
  // 高亮注释
  result = result.replace(/--([^\n]*)/g, '<span class="sql-comment">--$1</span>')
  
  return result
})
</script>

<template>
  <pre class="sql-highlight" v-html="highlightedCode"></pre>
</template>

<style scoped>
.sql-highlight {
  margin: 0;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  white-space: pre-wrap;
  font-size: 13px;
  line-height: 1.6;
  color: #2c3e50;
}

:deep(.sql-keyword) {
  color: #0000ff;
  font-weight: 600;
}

:deep(.sql-string) {
  color: #a31515;
}

:deep(.sql-number) {
  color: #098658;
}

:deep(.sql-identifier) {
  color: #795e26;
  font-weight: 500;
}

:deep(.sql-comment) {
  color: #008000;
  font-style: italic;
}
</style>
