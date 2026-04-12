<script setup lang="ts">
import Button from 'primevue/button'
import Message from 'primevue/message'
import type { WalletIdentity } from '../types/chat'

const props = defineProps<{
  identity: WalletIdentity | null
  busy: boolean
  error: string
  testIdentityEnabled: boolean
}>()

defineEmits<{
  connect: []
  'connect-test': []
  disconnect: []
}>()
</script>

<template>
  <section class="wallet-panel surface-panel">
    <div v-if="props.identity" class="wallet-state">
      <div class="wallet-copy">
        <p class="wallet-label">
          {{ props.identity.authMethod === 'guest' ? '测试身份已启用' : '钱包已连接' }}
        </p>
        <strong class="wallet-address">
          {{ `${props.identity.address.slice(0, 8)}...${props.identity.address.slice(-6)}` }}
        </strong>
        <span class="wallet-note">
          {{ props.identity.authMethod === 'guest' ? '仅用于调试，当前标签页有效' : '当前标签页有效' }}
        </span>
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
        <p class="wallet-label">连接身份</p>
        <span class="wallet-note">
          {{
            props.testIdentityEnabled
              ? '可连接钱包，或直接启用测试身份。'
              : '签名只保留在当前浏览器会话，用于生成临时聊天身份。'
          }}
        </span>
      </div>
      <div class="wallet-actions">
        <Button
          class="block-button wallet-button"
          :label="props.busy ? '签名中...' : '连接并签名'"
          icon="pi pi-wallet"
          :loading="props.busy"
          @click="$emit('connect')"
        />
        <Button
          v-if="props.testIdentityEnabled"
          class="block-button wallet-button"
          label="使用测试身份"
          icon="pi pi-user"
          severity="secondary"
          outlined
          :disabled="props.busy"
          @click="$emit('connect-test')"
        />
      </div>
    </div>

    <Message v-if="props.error" severity="error" size="small" variant="outlined">
      {{ props.error }}
    </Message>
  </section>
</template>
