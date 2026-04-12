import { appConfig } from './config'
import type {
  BackendSessionPayload,
  BackendUser,
  FriendRecord,
  FriendsResponse,
  GroupRecord,
  GroupsResponse,
  TurnCredentialsResponse,
  WalletIdentity,
} from '../types/chat'

type SessionInfo = BackendSessionPayload['session']

type RequestOptions = {
  method?: 'GET' | 'POST' | 'DELETE'
  token?: string | null
  body?: unknown
}

function buildUrl(path: string) {
  return new URL(path, `${appConfig.backendBaseUrl}/`).toString()
}

async function parseResponse(response: Response) {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error('后端返回了无法解析的 JSON。')
  }
}

async function request<T>(path: string, options: RequestOptions = {}) {
  const response = await fetch(buildUrl(path), {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  const payload = await parseResponse(response)

  if (!response.ok) {
    const message =
      typeof payload?.error === 'string'
        ? payload.error
        : `请求失败：${response.status}`
    throw new Error(message)
  }

  return payload as T
}

export async function createBackendSession(identity: WalletIdentity) {
  return request<BackendSessionPayload>('/api/auth/sessions', {
    method: 'POST',
    body: identity,
  })
}

export async function revokeBackendSession(token: string) {
  await request<null>('/api/auth/sessions/current', {
    method: 'DELETE',
    token,
  })
}

export async function fetchMe(token: string) {
  return request<{ user: BackendUser; session: SessionInfo }>('/api/me', {
    token,
  })
}

export async function fetchTurnCredentials(token: string) {
  return request<TurnCredentialsResponse>('/api/turn-credentials', {
    token,
  })
}

export async function fetchFriends(token: string) {
  return request<FriendsResponse>('/api/friends', {
    token,
  })
}

export async function sendFriendRequest(token: string, address: string) {
  return request<{ friendshipId: number; status: FriendRecord['status'] }>(
    '/api/friends/requests',
    {
      method: 'POST',
      token,
      body: { address },
    },
  )
}

export async function acceptFriendRequest(
  token: string,
  target: { friendshipId?: number | string; address?: string },
) {
  return request<{
    friendshipId: number
    status: FriendRecord['status']
    respondedAt: string | null
  }>('/api/friends/accept', {
    method: 'POST',
    token,
    body: target,
  })
}

export async function fetchGroups(token: string) {
  return request<GroupsResponse>('/api/groups', {
    token,
  })
}

export async function createGroup(
  token: string,
  name: string,
  memberAddresses: string[],
) {
  return request<{ group: GroupRecord }>('/api/groups', {
    method: 'POST',
    token,
    body: {
      name,
      memberAddresses,
    },
  })
}

export async function addGroupMember(
  token: string,
  groupId: string,
  address: string,
) {
  return request<{ group: GroupRecord }>(`/api/groups/${groupId}/members`, {
    method: 'POST',
    token,
    body: { address },
  })
}

export function buildBackendWsUrl(token: string) {
  const url = new URL(appConfig.backendWsUrl)
  url.searchParams.set('token', token)
  return url.toString()
}
