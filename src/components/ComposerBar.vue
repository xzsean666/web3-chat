<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'

const props = defineProps<{
  disabled: boolean
  busy: boolean
  maxLength: number
  onSend: (text: string) => Promise<boolean>
}>()

const draft = ref('')
const showCounter = computed(() => draft.value.length >= props.maxLength * 0.8)

async function submit() {
  if (props.disabled || props.busy) {
    return
  }

  const success = await props.onSend(draft.value)

  if (success) {
    draft.value = ''
  }
}
</script>

<template>
  <form class="composer" @submit.prevent="submit">
    <label class="composer-field">
      <Textarea
        v-model="draft"
        :disabled="disabled"
        :maxlength="maxLength"
        input-id="composer-draft"
        placeholder="输入消息"
        rows="1"
        auto-resize
        aria-label="消息输入框"
        fluid
        @keydown.meta.enter.prevent="submit"
        @keydown.ctrl.enter.prevent="submit"
      />
    </label>
    <div class="composer-actions">
      <span v-if="showCounter" class="composer-counter">{{ draft.length }} / {{ maxLength }}</span>
      <Button
        class="composer-button"
        type="submit"
        icon="pi pi-send"
        :loading="busy"
        :disabled="disabled || busy"
        rounded
        aria-label="发送消息"
      />
    </div>
  </form>
</template>
