<script setup lang="ts">
import Button from 'primevue/button'
import Message from 'primevue/message'
import type { WalletIdentity } from '../types/chat'

defineProps<{
  identity: WalletIdentity | null
  busy: boolean
  error: string
}>()

defineEmits<{
  connect: []
  disconnect: []
}>()
</script>

<template>
  <section class="wallet-panel surface-panel">
    <div v-if="identity" class="wallet-state">
      <div class="wallet-copy">
        <p class="wallet-label">钱包已连接</p>
        <strong class="wallet-address">
          {{ `${identity.address.slice(0, 8)}...${identity.address.slice(-6)}` }}
        </strong>
        <span class="wallet-note">当前标签页有效</span>
      </div>
      <Button
        label="清空会话"
        icon="pi pi-sign-out"
        severity="secondary"
        text
        @click="$emit('disconnect')"
      />
    </div>

    <div v-else class="wallet-state">
      <div class="wallet-copy">
        <p class="wallet-label">连接钱包</p>
        <span class="wallet-note">签名只保留在当前浏览器会话，用于生成临时聊天身份。</span>
      </div>
      <Button
        class="block-button wallet-button"
        :label="busy ? '签名中...' : '连接并签名'"
        icon="pi pi-wallet"
        :loading="busy"
        @click="$emit('connect')"
      />
    </div>

    <Message v-if="error" severity="error" size="small" variant="outlined">
      {{ error }}
    </Message>
  </section>
</template>
