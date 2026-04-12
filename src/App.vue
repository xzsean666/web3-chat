<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import ComposerBar from './components/ComposerBar.vue'
import MessageStream from './components/MessageStream.vue'
import WalletPanel from './components/WalletPanel.vue'
import { useChatAppStore } from './stores/chatApp'
import type { ConversationSummary, FriendRecord, GroupRecord } from './types/chat'
import { formatDateTime } from './utils/format'

type WorkspaceMode = 'chats' | 'friends' | 'groups'

const store = useChatAppStore()

const workspaceMode = ref<WorkspaceMode>('chats')
const draftFriendAddress = ref('')
const draftGroupName = ref('')
const draftGroupMembers = ref('')
const surfaceFeedback = ref('')
const surfaceFeedbackSeverity = ref<'error' | 'success'>('success')
let feedbackTimer: number | null = null

const workspaceOptions = [
  { label: '会话', value: 'chats' },
  { label: '好友', value: 'friends' },
  { label: '群组', value: 'groups' },
] satisfies Array<{ label: string; value: WorkspaceMode }>

const currentConversation = computed(() => store.currentConversation)
const hasConversations = computed(() => store.sortedConversations.length > 0)
const entryPrompt = computed(() =>
  store.testIdentityEnabled
    ? '连接钱包或启用测试身份后，即可添加好友并建立 P2P 聊天。'
    : '连接钱包后，即可添加好友并建立 P2P 聊天。',
)
const currentPresenceLabel = computed(() => {
  if (!currentConversation.value) {
    if (!store.identity) {
      return entryPrompt.value
    }

    if (hasConversations.value) {
      return '从下方会话列表里选择一个联系人或群聊。'
    }

    return '先添加好友或创建群聊，再开始聊天。'
  }

  if (store.connectionState === 'ready') {
    return currentConversation.value.kind === 'private'
      ? '已建立 P2P 通道'
      : `${store.peerProfiles.length + 1} 人在线`
  }

  if (store.connectionState === 'joining') {
    return '正在建立 P2P 通道'
  }

  if (store.peerProfiles.length > 0) {
    return '对端已在线，正在协商连接'
  }

  return currentConversation.value.kind === 'private'
    ? '等待对方上线'
    : '等待群成员上线'
})
const chatMetaLine = computed(() => {
  if (!currentConversation.value) {
    return ''
  }

  const typeLabel = currentConversation.value.kind === 'private' ? '私聊' : '群聊'
  return `${typeLabel} · ${currentPresenceLabel.value}`
})
const chatFootnote = computed(() => {
  if (!currentConversation.value) {
    return '后端只处理身份、好友关系、群组关系和 WebRTC 信令，聊天内容不入库。'
  }

  return store.canSendCurrentConversation
    ? '消息内容仅保存在当前设备浏览器，本次发送走 WebRTC DataChannel。'
    : '当前会话还没有可用的 P2P 通道，发送时会尝试走已建立连接。'
})
const workspaceTitle = computed(() => {
  if (workspaceMode.value === 'friends') {
    return '好友管理'
  }

  if (workspaceMode.value === 'groups') {
    return '群组管理'
  }

  return '最近会话'
})
const surfaceMessage = computed(() => {
  if (store.roomErrorMessage) {
    return {
      severity: 'error' as const,
      text: store.roomErrorMessage,
    }
  }

  if (surfaceFeedback.value) {
    return {
      severity: surfaceFeedbackSeverity.value,
      text: surfaceFeedback.value,
    }
  }

  return null
})

function setFeedback(message: string, severity: 'error' | 'success') {
  if (feedbackTimer !== null) {
    window.clearTimeout(feedbackTimer)
  }

  surfaceFeedback.value = message
  surfaceFeedbackSeverity.value = severity
  feedbackTimer = window.setTimeout(() => {
    surfaceFeedback.value = ''
    feedbackTimer = null
  }, 2600)
}

function clearFeedback() {
  if (feedbackTimer !== null) {
    window.clearTimeout(feedbackTimer)
    feedbackTimer = null
  }

  surfaceFeedback.value = ''
}

function parseGroupMembers() {
  return draftGroupMembers.value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function conversationStatusCopy(conversation: ConversationSummary) {
  const onlineLabel =
    conversation.kind === 'private'
      ? conversation.onlineCount > 0
        ? '在线'
        : '离线'
      : `${conversation.onlineCount} 人在线`

  if (!conversation.lastMessageAt) {
    return onlineLabel
  }

  return `${onlineLabel} · ${formatDateTime(conversation.lastMessageAt)}`
}

function friendStatusCopy(record: FriendRecord) {
  return record.online ? '在线，可建立 P2P 通道' : '离线，等待对方上线'
}

function groupStatusCopy(group: GroupRecord) {
  return `${group.onlineMemberCount} / ${group.members.length} 在线`
}

async function handleSelectConversation(conversationId: string) {
  clearFeedback()
  workspaceMode.value = 'chats'
  await store.selectConversation(conversationId)
}

async function handleOpenFriend(record: FriendRecord) {
  const conversation = store.sortedConversations.find(
    (item) => item.directAddress?.toLowerCase() === record.friend.address.toLowerCase(),
  )

  if (!conversation) {
    setFeedback('该好友还没有可用私聊会话。', 'error')
    return
  }

  await handleSelectConversation(conversation.id)
}

async function handleReconnect() {
  clearFeedback()
  await store.reconnectCurrentConversation()
}

async function handleSendFriendRequest() {
  const address = draftFriendAddress.value.trim()
  if (!address) {
    return
  }

  const success = await store.sendFriendRequest(address)
  if (!success) {
    return
  }

  draftFriendAddress.value = ''
  workspaceMode.value = 'friends'
  setFeedback('好友请求已发送。', 'success')
}

async function handleAcceptFriendRequest(friendshipId: number) {
  const success = await store.acceptFriendRequest(friendshipId)
  if (!success) {
    return
  }

  workspaceMode.value = 'chats'
  setFeedback('好友请求已接受。', 'success')
}

async function handleCreateGroup() {
  const success = await store.createGroup(
    draftGroupName.value,
    parseGroupMembers(),
  )

  if (!success) {
    return
  }

  draftGroupName.value = ''
  draftGroupMembers.value = ''
  workspaceMode.value = 'chats'
  setFeedback('群聊已创建。', 'success')
}

onMounted(async () => {
  await store.initialize()

  if (!store.sortedConversations.length && store.identity) {
    workspaceMode.value = 'friends'
  }
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
          <h1>{{ currentConversation ? currentConversation.title : '聊天' }}</h1>
          <p class="top-copy">{{ currentPresenceLabel }}</p>
        </div>
        <span class="status-pill">{{ store.transportLabel }}</span>
      </header>

      <WalletPanel
        :identity="store.identity"
        :busy="store.walletBusy"
        :error="store.walletErrorMessage"
        :test-identity-enabled="store.testIdentityEnabled"
        @connect="store.connectWallet"
        @connect-test="store.connectTestIdentity"
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

      <div class="phone-main">
        <section v-if="currentConversation" class="chat-card surface-panel">
          <div class="chat-card-head">
            <div class="chat-head-copy">
              <h2>{{ currentConversation.title }}</h2>
              <p class="chat-subcopy">{{ chatMetaLine }}</p>
            </div>
            <div class="chat-actions">
              <span class="room-badge">
                {{ currentConversation.kind === 'private' ? '私聊' : '群聊' }}
              </span>
              <Button
                icon="pi pi-refresh"
                severity="secondary"
                text
                rounded
                aria-label="重连当前会话"
                @click="handleReconnect"
              />
            </div>
          </div>

          <p class="chat-inline-note">{{ chatFootnote }}</p>

          <div class="chat-body">
            <MessageStream :messages="store.currentMessages" />
          </div>

          <footer class="chat-footer">
            <ComposerBar
              :busy="store.sendBusy"
              :disabled="!store.identity || !store.currentConversation"
              :max-length="store.maxMessageLength"
              :on-send="store.sendMessage"
            />
          </footer>
        </section>

        <section v-else class="empty-panel surface-panel">
          <p class="section-kicker">开始聊天</p>
          <h2>{{ hasConversations ? '选择一个会话' : '先添加好友' }}</h2>
          <p class="empty-copy">
            {{ hasConversations ? '会话已经准备好，点击下方列表即可进入聊天。' : entryPrompt }}
          </p>
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

          <div v-if="workspaceMode === 'chats'" class="room-list">
            <button
              v-for="conversation in store.sortedConversations"
              :key="conversation.id"
              class="room-item"
              :class="{ active: conversation.id === store.currentConversationId }"
              type="button"
              @click="handleSelectConversation(conversation.id)"
            >
              <div class="room-avatar">
                {{ conversation.kind === 'private' ? '私' : '群' }}
              </div>
              <div class="room-body">
                <strong>{{ conversation.title }}</strong>
                <span>{{ conversationStatusCopy(conversation) }}</span>
              </div>
              <span
                v-if="conversation.id === store.currentConversationId"
                class="room-badge"
              >
                打开中
              </span>
              <i v-else class="pi pi-angle-right room-arrow"></i>
            </button>

            <p v-if="!store.sortedConversations.length" class="empty-copy">
              还没有会话。先去好友页发请求，或者创建一个群聊。
            </p>
          </div>

          <div v-else-if="workspaceMode === 'friends'" class="stack-block">
            <div class="field-block">
              <label for="friend-address">添加好友</label>
              <div class="inline-form">
                <InputText
                  id="friend-address"
                  v-model="draftFriendAddress"
                  placeholder="输入对方钱包地址，例如 0x..."
                  fluid
                />
                <Button
                  class="inline-button"
                  label="发送请求"
                  icon="pi pi-user-plus"
                  @click="handleSendFriendRequest"
                />
              </div>
            </div>

            <div class="list-section">
              <div class="list-section-head">
                <h3>待接受</h3>
                <span>{{ store.pendingInbound.length }}</span>
              </div>
              <div v-if="store.pendingInbound.length" class="mini-list">
                <article
                  v-for="record in store.pendingInbound"
                  :key="record.id"
                  class="list-card"
                >
                  <div class="list-card-copy">
                    <strong>{{ record.friend.address }}</strong>
                    <span>{{ friendStatusCopy(record) }}</span>
                  </div>
                  <Button
                    class="inline-button"
                    label="接受"
                    size="small"
                    @click="handleAcceptFriendRequest(record.id)"
                  />
                </article>
              </div>
              <p v-else class="empty-copy">当前没有待接受的好友请求。</p>
            </div>

            <div class="list-section">
              <div class="list-section-head">
                <h3>好友列表</h3>
                <span>{{ store.acceptedFriends.length }}</span>
              </div>
              <div v-if="store.acceptedFriends.length" class="mini-list">
                <button
                  v-for="record in store.acceptedFriends"
                  :key="record.id"
                  class="list-card list-card-button"
                  type="button"
                  @click="handleOpenFriend(record)"
                >
                  <div class="list-card-copy">
                    <strong>{{ record.friend.address }}</strong>
                    <span>{{ friendStatusCopy(record) }}</span>
                  </div>
                  <i class="pi pi-angle-right room-arrow"></i>
                </button>
              </div>
              <p v-else class="empty-copy">还没有已接受的好友。</p>
            </div>

            <div class="list-section">
              <div class="list-section-head">
                <h3>已发请求</h3>
                <span>{{ store.pendingOutbound.length }}</span>
              </div>
              <div v-if="store.pendingOutbound.length" class="mini-list">
                <article
                  v-for="record in store.pendingOutbound"
                  :key="record.id"
                  class="list-card"
                >
                  <div class="list-card-copy">
                    <strong>{{ record.friend.address }}</strong>
                    <span>等待对方接受</span>
                  </div>
                </article>
              </div>
              <p v-else class="empty-copy">当前没有待处理的外发请求。</p>
            </div>
          </div>

          <div v-else class="stack-block">
            <div class="field-block">
              <label for="group-name">创建群聊</label>
              <InputText
                id="group-name"
                v-model="draftGroupName"
                placeholder="例如：产品讨论组"
                maxlength="32"
                fluid
              />
            </div>

            <div class="field-block">
              <label for="group-members">初始成员地址</label>
              <Textarea
                id="group-members"
                v-model="draftGroupMembers"
                placeholder="用空格、换行或逗号分隔多个钱包地址"
                rows="4"
                auto-resize
                fluid
              />
            </div>

            <Button
              class="block-button"
              label="创建群聊"
              icon="pi pi-users"
              @click="handleCreateGroup"
            />

            <div class="list-section">
              <div class="list-section-head">
                <h3>已有群组</h3>
                <span>{{ store.groups.length }}</span>
              </div>
              <div v-if="store.groups.length" class="mini-list">
                <button
                  v-for="group in store.groups"
                  :key="group.id"
                  class="list-card list-card-button"
                  type="button"
                  @click="handleSelectConversation(`group:${group.id}`)"
                >
                  <div class="list-card-copy">
                    <strong>{{ group.name }}</strong>
                    <span>{{ groupStatusCopy(group) }}</span>
                  </div>
                  <i class="pi pi-angle-right room-arrow"></i>
                </button>
              </div>
              <p v-else class="empty-copy">还没有群聊，先创建一个。</p>
            </div>
          </div>

          <p class="workspace-hint">{{ chatFootnote }}</p>
        </section>
      </div>
    </div>
  </div>
</template>
