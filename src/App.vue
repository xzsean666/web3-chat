<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import ComposerBar from './components/ComposerBar.vue'
import MessageStream from './components/MessageStream.vue'
import WalletPanel from './components/WalletPanel.vue'
import { useChatAppStore } from './stores/chatApp'
import type { KnownRoom, RoomKind } from './types/chat'
import { formatDateTime } from './utils/format'
import { isInviteExpired } from './utils/invite'

type WorkspaceMode = 'rooms' | 'create' | 'import'

const store = useChatAppStore()

const roomKindOptions = [
  { label: '私聊', value: 'private' },
  { label: '群聊', value: 'group' },
] satisfies Array<{ label: string; value: RoomKind }>

const draftTitle = ref('')
const draftInvite = ref('')
const draftKind = ref<RoomKind>('private')
const workspaceMode = ref<WorkspaceMode>('create')
const shareFeedback = ref('')
const shareFeedbackSeverity = ref<'error' | 'success'>('success')
let feedbackTimer: number | null = null

const currentRoom = computed(() => store.currentRoom)
const hasRooms = computed(() => store.sortedRooms.length > 0)
const roomHasSecret = computed(() => Boolean(currentRoom.value?.secret))
const roomPreviewMap = computed(() => store.roomPreviewMap)
const roomExpiryLabel = computed(() =>
  currentRoom.value ? formatDateTime(currentRoom.value.expiresAt) : '',
)
const roomExpired = computed(() =>
  currentRoom.value ? isInviteExpired(currentRoom.value.expiresAt) : false,
)
const roomPresenceLabel = computed(() => {
  if (!currentRoom.value) {
    return '连接钱包后，创建或导入一个聊天房间。'
  }

  if (!roomHasSecret.value) {
    return '当前设备未保存口令，请重新导入邀请。'
  }

  if (store.connectionState === 'joining') {
    return '正在建立连接'
  }

  if (store.peerProfiles.length === 0) {
    return '等待对方加入'
  }

  return `${store.peerProfiles.length + 1} 人在线`
})
const chatMetaLine = computed(() => {
  if (!currentRoom.value) {
    return ''
  }

  const roomType = currentRoom.value.kind === 'private' ? '私聊' : '群聊'
  const expiry = roomExpired.value ? '已过期' : `有效至 ${roomExpiryLabel.value}`
  return `${roomType} · ${roomPresenceLabel.value} · ${expiry}`
})
const chatFootnote = computed(() => {
  if (!currentRoom.value) {
    return ''
  }

  if (!roomHasSecret.value) {
    return '当前设备只有房间索引，没有邀请口令。'
  }

  return `连接策略：${store.transportLabel}`
})
const workspaceOptions = computed(() => {
  const options = [] as Array<{ label: string; value: WorkspaceMode }>

  if (hasRooms.value) {
    options.push({ label: '房间', value: 'rooms' })
  }

  options.push(
    { label: '新建', value: 'create' },
    { label: '导入', value: 'import' },
  )

  return options
})
const workspaceTitle = computed(() => {
  if (workspaceMode.value === 'rooms') {
    return '最近聊天'
  }

  if (workspaceMode.value === 'create') {
    return '新建聊天'
  }

  return '导入邀请'
})
const surfaceMessage = computed(() => {
  if (store.roomErrorMessage) {
    return {
      severity: 'error' as const,
      text: store.roomErrorMessage,
    }
  }

  if (shareFeedback.value) {
    return {
      severity: shareFeedbackSeverity.value,
      text: shareFeedback.value,
    }
  }

  return null
})

function setFeedback(message: string, severity: 'error' | 'success') {
  if (feedbackTimer !== null) {
    window.clearTimeout(feedbackTimer)
  }

  shareFeedback.value = message
  shareFeedbackSeverity.value = severity
  feedbackTimer = window.setTimeout(() => {
    shareFeedback.value = ''
    feedbackTimer = null
  }, 2400)
}

function clearFeedback() {
  if (feedbackTimer !== null) {
    window.clearTimeout(feedbackTimer)
    feedbackTimer = null
  }

  shareFeedback.value = ''
}

function syncWorkspaceMode() {
  if (!hasRooms.value && workspaceMode.value === 'rooms') {
    workspaceMode.value = 'create'
    return
  }

  if (!hasRooms.value && !currentRoom.value) {
    workspaceMode.value = 'create'
  }
}

function roomStatusCopy(room: KnownRoom) {
  const preview = roomPreviewMap.value[room.roomId] ?? '等待新消息'

  if (!room.secret) {
    return `需重新导入 · ${preview}`
  }

  if (isInviteExpired(room.expiresAt)) {
    return `已过期 · ${preview}`
  }

  return `${preview} · ${formatDateTime(room.lastMessageAt ?? room.expiresAt)}`
}

async function handleCreateRoom() {
  const room = await store.createRoom(draftKind.value, draftTitle.value)
  draftTitle.value = ''

  if (room) {
    workspaceMode.value = 'rooms'
    setFeedback('房间已创建，复制邀请发给对方即可。', 'success')
  }
}

async function handleImportInvite() {
  if (!draftInvite.value.trim()) {
    return
  }

  const imported = await store.importInvite(draftInvite.value)
  if (imported) {
    draftInvite.value = ''
    workspaceMode.value = 'rooms'
    setFeedback('邀请已导入。', 'success')
  }
}

async function handleCopyInvite() {
  if (!currentRoom.value?.inviteLink) {
    setFeedback('当前设备没有可复制的邀请链接。', 'error')
    return
  }

  try {
    await navigator.clipboard.writeText(currentRoom.value.inviteLink)
    setFeedback('邀请链接已复制。', 'success')
  } catch {
    setFeedback('复制失败，请检查浏览器剪贴板权限。', 'error')
  }
}

async function handleReconnect() {
  clearFeedback()
  await store.reconnectCurrentRoom()
}

async function handleSelectRoom(roomId: string) {
  clearFeedback()
  workspaceMode.value = 'rooms'
  await store.selectRoom(roomId)
}

watch(
  () => store.sortedRooms.length,
  () => {
    syncWorkspaceMode()
  },
)

onMounted(async () => {
  await store.initialize()

  if (store.sortedRooms.length) {
    workspaceMode.value = 'rooms'
  }

  syncWorkspaceMode()
})

onBeforeUnmount(() => {
  clearFeedback()
})
</script>

<template>
  <div class="app-shell">
    <div class="phone-shell">
      <header class="phone-topbar">
        <div class="brand-copy">
          <p class="top-kicker">Web3 Chat</p>
          <h1>{{ currentRoom ? currentRoom.title : '聊天' }}</h1>
          <p class="top-copy">
            {{
              currentRoom
                ? roomPresenceLabel
                : store.identity
                  ? '已连接钱包，创建或导入一个房间开始聊天。'
                  : '连接钱包后即可进入私聊或群聊。'
            }}
          </p>
        </div>
        <span class="status-pill">{{ store.transportLabel }}</span>
      </header>

      <WalletPanel
        :identity="store.identity"
        :busy="store.walletBusy"
        :error="store.walletErrorMessage"
        @connect="store.connectWallet"
        @disconnect="store.disconnectWallet"
      />

      <Message
        v-if="surfaceMessage"
        class="surface-message"
        :severity="surfaceMessage.severity"
        size="small"
        variant="outlined"
      >
        {{ surfaceMessage.text }}
      </Message>

      <section v-if="currentRoom" class="chat-card surface-panel">
        <div class="chat-card-head">
          <div class="chat-head-copy">
            <h2>{{ currentRoom.title }}</h2>
            <p class="chat-subcopy">{{ chatMetaLine }}</p>
          </div>
          <div class="chat-actions">
            <Button
              icon="pi pi-refresh"
              severity="secondary"
              text
              rounded
              aria-label="重新连接当前房间"
              @click="handleReconnect"
            />
            <Button
              icon="pi pi-copy"
              text
              rounded
              :disabled="!currentRoom.inviteLink"
              aria-label="复制当前房间邀请链接"
              @click="handleCopyInvite"
            />
          </div>
        </div>

        <p class="chat-inline-note">{{ chatFootnote }}</p>

        <MessageStream :messages="store.currentMessages" />

        <ComposerBar
          :busy="store.sendBusy"
          :disabled="!store.identity || !store.currentRoom || roomExpired || !roomHasSecret"
          :max-length="store.maxMessageLength"
          :on-send="store.sendMessage"
        />
      </section>

      <section v-else class="empty-panel surface-panel">
        <p class="section-kicker">开始聊天</p>
        <h2>先创建一个房间</h2>
        <p class="empty-copy">不需要业务后端。连接钱包后即可新建或导入邀请。</p>
      </section>

      <section class="workspace-panel surface-panel">
        <div class="workspace-header">
          <div>
            <p class="section-kicker">工作区</p>
            <h2>{{ workspaceTitle }}</h2>
          </div>
          <SelectButton
            v-model="workspaceMode"
            class="segmented-control workspace-switch"
            :options="workspaceOptions"
            option-label="label"
            option-value="value"
            aria-label="工作区切换"
          />
        </div>

        <div v-if="workspaceMode === 'rooms'" class="room-list">
          <button
            v-for="room in store.sortedRooms"
            :key="room.roomId"
            class="room-item"
            :class="{ active: room.roomId === store.currentRoomId }"
            type="button"
            @click="handleSelectRoom(room.roomId)"
          >
            <div class="room-avatar">
              {{ room.kind === 'private' ? '私' : '群' }}
            </div>
            <div class="room-body">
              <strong>{{ room.title }}</strong>
              <span>{{ roomStatusCopy(room) }}</span>
            </div>
            <span v-if="room.roomId === store.currentRoomId" class="room-badge">打开中</span>
            <i v-else class="pi pi-angle-right room-arrow"></i>
          </button>

          <p v-if="!store.sortedRooms.length" class="empty-copy">
            还没有聊天记录。先新建一个房间，或导入一条邀请。
          </p>
        </div>

        <div v-else-if="workspaceMode === 'create'" class="stack-block">
          <div class="field-block">
            <label for="room-kind">聊天类型</label>
            <SelectButton
              input-id="room-kind"
              v-model="draftKind"
              class="segmented-control"
              :options="roomKindOptions"
              option-label="label"
              option-value="value"
              aria-label="聊天类型"
              fluid
            />
          </div>

          <div class="field-block">
            <label for="room-title">房间名称</label>
            <InputText
              input-id="room-title"
              v-model="draftTitle"
              :placeholder="draftKind === 'private' ? '例如：产品沟通' : '例如：研发群聊'"
              maxlength="24"
              fluid
            />
          </div>

          <Button
            class="block-button"
            label="创建并进入"
            icon="pi pi-plus"
            @click="handleCreateRoom"
          />
        </div>

        <div v-else class="stack-block">
          <div class="field-block">
            <label for="invite-link">邀请链接</label>
            <Textarea
              input-id="invite-link"
              v-model="draftInvite"
              placeholder="粘贴邀请链接"
              rows="4"
              auto-resize
              fluid
            />
          </div>

          <Button
            class="block-button"
            label="导入邀请"
            icon="pi pi-link"
            severity="secondary"
            @click="handleImportInvite"
          />
        </div>

        <p class="workspace-hint">
          {{ currentRoom ? chatFootnote : `连接策略：${store.transportLabel}` }}
        </p>
      </section>
    </div>
  </div>
</template>
