<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { ChatMessage } from '../types/chat'
import { formatTime } from '../utils/format'

const props = defineProps<{
  messages: ChatMessage[]
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const normalizedMessages = computed(() => props.messages)

function getMessageStatusLabel(message: ChatMessage) {
  if (message.direction !== 'outbound' || !message.status) {
    return ''
  }

  if (message.status === 'sending') {
    return '发送中'
  }

  if (message.status === 'sent') {
    return '已发送'
  }

  if (message.status === 'delivered') {
    return '已送达'
  }

  return '发送失败'
}

watch(
  () => normalizedMessages.value.length,
  async (_, previousLength) => {
    await nextTick()
    containerRef.value?.scrollTo({
      top: containerRef.value.scrollHeight,
      behavior: previousLength ? 'smooth' : 'auto',
    })
  },
)
</script>

<template>
  <div ref="containerRef" class="message-stream" role="log" aria-live="polite">
    <template v-if="normalizedMessages.length">
      <article
        v-for="message in normalizedMessages"
        :key="message.id"
        class="message-row"
        :class="message.direction"
      >
        <div v-if="message.direction === 'system'" class="message-system">
          <span>{{ message.text }}</span>
        </div>

        <template v-else>
          <div class="message-meta">
            <strong>{{ message.direction === 'outbound' ? '我' : message.senderLabel }}</strong>
            <span>{{ formatTime(message.createdAt) }}</span>
            <span
              v-if="message.direction === 'outbound' && message.status"
              class="message-status"
              :class="message.status"
            >
              {{ getMessageStatusLabel(message) }}
            </span>
          </div>
          <div class="message-bubble">
            {{ message.text }}
          </div>
        </template>
      </article>
    </template>

    <div v-else class="message-empty">
      <strong>等待消息</strong>
      <p>连接建立后，消息会显示在这里。</p>
    </div>
  </div>
</template>
