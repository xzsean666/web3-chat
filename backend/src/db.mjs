import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { serverConfig } from './config.mjs'

function ensureDatabaseDirectory(dbFile) {
  if (!dbFile || dbFile === ':memory:') {
    return
  }

  mkdirSync(dirname(dbFile), { recursive: true })
}

function mapUserRow(row) {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    address: row.address,
    addressLower: row.address_lower,
    authMethod: row.auth_method,
    chainId: row.chain_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at,
  }
}

function mapJoinedSessionRow(row) {
  if (!row) {
    return null
  }

  return {
    id: row.session_id,
    userId: row.session_user_id,
    tokenHash: row.token_hash,
    walletSessionId: row.wallet_session_id,
    authMethod: row.session_auth_method,
    chainId: row.session_chain_id,
    sessionPublicKey: row.session_public_key,
    issuedAt: row.session_issued_at,
    expiresAt: row.session_expires_at,
    createdAt: row.session_created_at,
    lastSeenAt: row.session_last_seen_at,
    revokedAt: row.session_revoked_at,
    user: {
      id: row.user_id,
      address: row.user_address,
      addressLower: row.user_address_lower,
      authMethod: row.user_auth_method,
      chainId: row.user_chain_id,
      createdAt: row.user_created_at,
      updatedAt: row.user_updated_at,
      lastSeenAt: row.user_last_seen_at,
    },
  }
}

function mapFriendshipRow(row) {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    status: row.status,
    direction: row.direction,
    requesterUserId: row.requester_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    respondedAt: row.responded_at,
    friend: {
      id: row.friend_id,
      address: row.friend_address,
      addressLower: row.friend_address_lower,
      authMethod: row.friend_auth_method,
      chainId: row.friend_chain_id,
      createdAt: row.friend_created_at,
      updatedAt: row.friend_updated_at,
      lastSeenAt: row.friend_last_seen_at,
    },
  }
}

function mapGroupMemberRow(row) {
  return {
    id: row.user_id,
    address: row.address,
    addressLower: row.address_lower,
    authMethod: row.auth_method,
    chainId: row.chain_id,
    role: row.role,
    joinedAt: row.joined_at,
  }
}

function createDatabase(dbFile) {
  ensureDatabaseDirectory(dbFile)
  const database = new DatabaseSync(dbFile)

  database.exec('PRAGMA foreign_keys = ON')
  database.exec('PRAGMA journal_mode = WAL')
  database.exec('PRAGMA busy_timeout = 5000')

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address TEXT NOT NULL,
      address_lower TEXT NOT NULL UNIQUE,
      auth_method TEXT NOT NULL,
      chain_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      wallet_session_id TEXT NOT NULL,
      auth_method TEXT NOT NULL,
      chain_id INTEGER,
      session_public_key TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      revoked_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id
      ON sessions(user_id);

    CREATE INDEX IF NOT EXISTS idx_sessions_active_lookup
      ON sessions(token_hash, expires_at, revoked_at);

    CREATE TABLE IF NOT EXISTS friendships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_low_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_high_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      requester_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      responded_at TEXT,
      UNIQUE(user_low_id, user_high_id),
      CHECK (user_low_id < user_high_id)
    );

    CREATE INDEX IF NOT EXISTS idx_friendships_requester
      ON friendships(requester_user_id, status);

    CREATE TABLE IF NOT EXISTS chat_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS group_members (
      group_id TEXT NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
      added_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (group_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_group_members_user
      ON group_members(user_id);
  `)

  return database
}

export const db = createDatabase(serverConfig.dbFile)

export function upsertUserFromIdentity(identity, now) {
  const row = db
    .prepare(`
      INSERT INTO users (
        address,
        address_lower,
        auth_method,
        chain_id,
        created_at,
        updated_at,
        last_seen_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(address_lower) DO UPDATE SET
        address = excluded.address,
        auth_method = excluded.auth_method,
        chain_id = excluded.chain_id,
        updated_at = excluded.updated_at,
        last_seen_at = excluded.last_seen_at
      RETURNING *
    `)
    .get(
      identity.address,
      identity.address.toLowerCase(),
      identity.authMethod,
      identity.chainId,
      now,
      now,
      now,
    )

  return mapUserRow(row)
}

export function ensureUserByAddress(address, now, options = {}) {
  const row = db
    .prepare(`
      INSERT INTO users (
        address,
        address_lower,
        auth_method,
        chain_id,
        created_at,
        updated_at,
        last_seen_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(address_lower) DO UPDATE SET
        address = excluded.address,
        updated_at = excluded.updated_at
      RETURNING *
    `)
    .get(
      address,
      address.toLowerCase(),
      options.authMethod ?? 'wallet',
      options.chainId ?? null,
      now,
      now,
      now,
    )

  return mapUserRow(row)
}

export function createSession(user, identity, tokenHash, now, expiresAt) {
  const row = db
    .prepare(`
      INSERT INTO sessions (
        user_id,
        token_hash,
        wallet_session_id,
        auth_method,
        chain_id,
        session_public_key,
        issued_at,
        expires_at,
        created_at,
        last_seen_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `)
    .get(
      user.id,
      tokenHash,
      identity.sessionId,
      identity.authMethod,
      identity.chainId,
      identity.sessionPublicKey,
      identity.issuedAt,
      expiresAt,
      now,
      now,
    )

  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    walletSessionId: row.wallet_session_id,
    authMethod: row.auth_method,
    chainId: row.chain_id,
    sessionPublicKey: row.session_public_key,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    revokedAt: row.revoked_at,
    user,
  }
}

export function getSessionByTokenHash(tokenHash, now) {
  const row = db
    .prepare(`
      SELECT
        s.id AS session_id,
        s.user_id AS session_user_id,
        s.token_hash,
        s.wallet_session_id,
        s.auth_method AS session_auth_method,
        s.chain_id AS session_chain_id,
        s.session_public_key,
        s.issued_at AS session_issued_at,
        s.expires_at AS session_expires_at,
        s.created_at AS session_created_at,
        s.last_seen_at AS session_last_seen_at,
        s.revoked_at AS session_revoked_at,
        u.id AS user_id,
        u.address AS user_address,
        u.address_lower AS user_address_lower,
        u.auth_method AS user_auth_method,
        u.chain_id AS user_chain_id,
        u.created_at AS user_created_at,
        u.updated_at AS user_updated_at,
        u.last_seen_at AS user_last_seen_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
        AND s.revoked_at IS NULL
        AND s.expires_at > ?
      LIMIT 1
    `)
    .get(tokenHash, now)

  return mapJoinedSessionRow(row)
}

export function touchSession(session, now) {
  db.prepare(
    `
      UPDATE sessions
      SET last_seen_at = ?
      WHERE id = ?
    `,
  ).run(now, session.id)

  db.prepare(
    `
      UPDATE users
      SET last_seen_at = ?, updated_at = ?
      WHERE id = ?
    `,
  ).run(now, now, session.user.id)
}

export function revokeSession(tokenHash, now) {
  db.prepare(
    `
      UPDATE sessions
      SET revoked_at = ?
      WHERE token_hash = ?
        AND revoked_at IS NULL
    `,
  ).run(now, tokenHash)
}

export function getUserByAddress(address) {
  const row = db
    .prepare(
      `
        SELECT *
        FROM users
        WHERE address_lower = ?
        LIMIT 1
      `,
    )
    .get(address.toLowerCase())

  return mapUserRow(row)
}

export function getFriendshipSummary(userId, friendUserId) {
  const lowId = Math.min(userId, friendUserId)
  const highId = Math.max(userId, friendUserId)
  const row = db
    .prepare(
      `
        SELECT
          id,
          status,
          requester_user_id,
          created_at,
          updated_at,
          responded_at
        FROM friendships
        WHERE user_low_id = ?
          AND user_high_id = ?
        LIMIT 1
      `,
    )
    .get(lowId, highId)

  if (!row) {
    return null
  }

  return {
    id: row.id,
    status: row.status,
    requesterUserId: row.requester_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    respondedAt: row.responded_at,
  }
}

export function listFriendshipsForUser(userId) {
  const rows = db
    .prepare(`
      SELECT
        f.id,
        f.status,
        f.requester_user_id,
        f.created_at,
        f.updated_at,
        f.responded_at,
        CASE
          WHEN f.requester_user_id = ? THEN 'outbound'
          ELSE 'inbound'
        END AS direction,
        other.id AS friend_id,
        other.address AS friend_address,
        other.address_lower AS friend_address_lower,
        other.auth_method AS friend_auth_method,
        other.chain_id AS friend_chain_id,
        other.created_at AS friend_created_at,
        other.updated_at AS friend_updated_at,
        other.last_seen_at AS friend_last_seen_at
      FROM friendships f
      JOIN users other
        ON other.id = CASE
          WHEN f.user_low_id = ? THEN f.user_high_id
          ELSE f.user_low_id
        END
      WHERE f.user_low_id = ?
         OR f.user_high_id = ?
      ORDER BY f.updated_at DESC, f.id DESC
    `)
    .all(userId, userId, userId, userId)

  return rows.map(mapFriendshipRow)
}

export function createOrUpdateFriendship(requesterUserId, targetUserId, now) {
  if (requesterUserId === targetUserId) {
    throw new Error('不能添加自己为好友。')
  }

  const lowId = Math.min(requesterUserId, targetUserId)
  const highId = Math.max(requesterUserId, targetUserId)
  const existing = db
    .prepare(
      `
        SELECT *
        FROM friendships
        WHERE user_low_id = ?
          AND user_high_id = ?
        LIMIT 1
      `,
    )
    .get(lowId, highId)

  if (!existing) {
    return db
      .prepare(`
        INSERT INTO friendships (
          user_low_id,
          user_high_id,
          requester_user_id,
          status,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, 'pending', ?, ?)
        RETURNING
          id,
          status,
          requester_user_id,
          created_at,
          updated_at,
          responded_at
      `)
      .get(lowId, highId, requesterUserId, now, now)
  }

  if (existing.status === 'blocked') {
    throw new Error('当前好友关系已被屏蔽。')
  }

  if (existing.status === 'pending' && existing.requester_user_id !== requesterUserId) {
    return db
      .prepare(`
        UPDATE friendships
        SET status = 'accepted',
            updated_at = ?,
            responded_at = ?
        WHERE id = ?
        RETURNING
          id,
          status,
          requester_user_id,
          created_at,
          updated_at,
          responded_at
      `)
      .get(now, now, existing.id)
  }

  return {
    id: existing.id,
    status: existing.status,
    requester_user_id: existing.requester_user_id,
    created_at: existing.created_at,
    updated_at: existing.updated_at,
    responded_at: existing.responded_at,
  }
}

export function acceptFriendship(userId, now, options = {}) {
  let row = null

  if (options.friendshipId) {
    row = db
      .prepare(
        `
          SELECT *
          FROM friendships
          WHERE id = ?
            AND status = 'pending'
            AND requester_user_id != ?
            AND (user_low_id = ? OR user_high_id = ?)
          LIMIT 1
        `,
      )
      .get(options.friendshipId, userId, userId, userId)
  } else if (options.targetUserId) {
    const lowId = Math.min(userId, options.targetUserId)
    const highId = Math.max(userId, options.targetUserId)
    row = db
      .prepare(
        `
          SELECT *
          FROM friendships
          WHERE user_low_id = ?
            AND user_high_id = ?
            AND status = 'pending'
            AND requester_user_id != ?
          LIMIT 1
        `,
      )
      .get(lowId, highId, userId)
  }

  if (!row) {
    return null
  }

  return db
    .prepare(`
      UPDATE friendships
      SET status = 'accepted',
          updated_at = ?,
          responded_at = ?
      WHERE id = ?
      RETURNING
        id,
        status,
        requester_user_id,
        created_at,
        updated_at,
        responded_at
    `)
    .get(now, now, row.id)
}

export function createGroup({ id, name, ownerUserId, memberUserIds, now }) {
  db.exec('BEGIN')

  try {
    db.prepare(
      `
        INSERT INTO chat_groups (
          id,
          name,
          created_by_user_id,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?)
      `,
    ).run(id, name, ownerUserId, now, now)

    const insertMember = db.prepare(
      `
        INSERT OR IGNORE INTO group_members (
          group_id,
          user_id,
          role,
          added_by_user_id,
          created_at
        )
        VALUES (?, ?, ?, ?, ?)
      `,
    )

    insertMember.run(id, ownerUserId, 'owner', ownerUserId, now)

    for (const memberUserId of memberUserIds) {
      if (memberUserId === ownerUserId) {
        continue
      }

      insertMember.run(id, memberUserId, 'member', ownerUserId, now)
    }

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return getGroupById(id)
}

export function addGroupMember(groupId, targetUserId, actorUserId, now) {
  db.prepare(
    `
      INSERT OR IGNORE INTO group_members (
        group_id,
        user_id,
        role,
        added_by_user_id,
        created_at
      )
      VALUES (?, ?, 'member', ?, ?)
    `,
  ).run(groupId, targetUserId, actorUserId, now)

  db.prepare(
    `
      UPDATE chat_groups
      SET updated_at = ?
      WHERE id = ?
    `,
  ).run(now, groupId)

  return getGroupById(groupId)
}

export function getGroupMembership(groupId, userId) {
  return (
    db
      .prepare(
        `
          SELECT role, created_at
          FROM group_members
          WHERE group_id = ?
            AND user_id = ?
          LIMIT 1
        `,
      )
      .get(groupId, userId) ?? null
  )
}

export function listGroupMembers(groupId) {
  const rows = db
    .prepare(
      `
        SELECT
          u.id AS user_id,
          u.address,
          u.address_lower,
          u.auth_method,
          u.chain_id,
          gm.role,
          gm.created_at AS joined_at
        FROM group_members gm
        JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = ?
        ORDER BY CASE gm.role WHEN 'owner' THEN 0 ELSE 1 END,
                 gm.created_at ASC
      `,
    )
    .all(groupId)

  return rows.map(mapGroupMemberRow)
}

export function getGroupById(groupId) {
  const row = db
    .prepare(
      `
        SELECT
          g.id,
          g.name,
          g.created_by_user_id,
          g.created_at,
          g.updated_at
        FROM chat_groups g
        WHERE g.id = ?
        LIMIT 1
      `,
    )
    .get(groupId)

  if (!row) {
    return null
  }

  return {
    id: row.id,
    name: row.name,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    members: listGroupMembers(groupId),
  }
}

export function listGroupsForUser(userId) {
  const rows = db
    .prepare(
      `
        SELECT
          g.id,
          g.name,
          g.created_by_user_id,
          g.created_at,
          g.updated_at,
          gm.role AS member_role
        FROM chat_groups g
        JOIN group_members gm
          ON gm.group_id = g.id
        WHERE gm.user_id = ?
        ORDER BY g.updated_at DESC, g.created_at DESC
      `,
    )
    .all(userId)

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    role: row.member_role,
    members: listGroupMembers(row.id),
  }))
}
