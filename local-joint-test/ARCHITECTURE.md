# Multi-Repo Joint Architecture & Integration Topology

本文档说明 `web3-chat` 联合测试工程涉及的 6 大代码仓库的系统架构拓扑、交互协议与端到端数据流。

---

## 1. 系统架构与仓库依赖拓扑

```mermaid
graph TD
    subgraph Client["前端客户端 (web3-chat)"]
        UI["React Native 4-Tab UI"]
        CE["ChatEngineService"]
        PS["PeriodicSyncService"]
        WC["WalletCore / KeyStore"]
        SC["SocialContractService"]
        LD["LuckyDropService"]
        DBRIDGE["Discover EIP-1193 Bridge"]
    end

    subgraph Relayer["服务端中继 (web3-chat-worker)"]
        Hono["Hono HTTP Router"]
        AuthMiddleware["EIP-191 Auth Guard"]
        D1["Cloudflare D1 (SQLite)"]
        R2["Cloudflare R2 (Audio/Media)"]
        WorkerCS["ContractService (On-Chain Verifier)"]
    end

    subgraph Contracts["链上协议层 (web3-chat-contract & LuckyDrop)"]
        Factory["ChatStorageFactory.sol"]
        UserClone["UserClone (EIP-1167)"]
        GroupClone["GroupClone (EIP-1167)"]
        RelMgr["RelationshipManager.sol"]
        LuckyProxy["LuckyDropProxy.sol (UUPS)"]
        LuckyImpl["LuckyDrop.sol"]
        Token["MockERC20 (LRPT)"]
    end

    subgraph Infra["底层设施 SDK (evm-call & EVM-Data-SDK)"]
        EvmCall["evm-call (RPC Pool & Multicall3)"]
        EvmData["EVM-Data-SDK (Multi-Provider Route)"]
        Anvil["Local Anvil Node (Port 8548)"]
    end

    UI --> CE
    UI --> SC
    UI --> LD
    UI --> DBRIDGE
    CE --> PS
    PS -->|"/sync, /messages"| Hono
    WC -->|SIWE Sign| Hono
    Hono --> AuthMiddleware
    AuthMiddleware --> D1
    Hono --> D1
    Hono --> R2
    Hono --> WorkerCS
    WorkerCS -->|JSON-RPC| Anvil
    SC -->|@web3-chat/sdk| EvmCall
    LD -->|@luckydrop/sdk| EvmCall
    DBRIDGE --> EvmCall
    EvmCall -->|HTTP RPC| Anvil
    Factory -.->|Clones| UserClone
    Factory -.->|Clones| GroupClone
    Factory <--> RelMgr
    LuckyProxy --> LuckyImpl
    LuckyImpl --> Token
    EvmData -.->|Config & Route| Anvil
```

---

## 2. 核心交互流时序图

### 2.1 链上身份与 SIWE 鉴权流 (Stages 2 & 3)

```mermaid
sequenceDiagram
    autonumber
    participant Alice as Alice Client
    participant Factory as ChatStorageFactory
    participant Worker as web3-chat-worker
    participant D1 as D1 Database

    Alice->>Factory: createUser()
    Factory-->>Alice: UserClone deployed (0xAliceClone)
    Alice->>Alice: signMessage(EIP-191 SIWE challenge)
    Alice->>Worker: POST /auth/verify { address, signature, nonce }
    Worker->>Worker: verifyMessage(signature)
    Worker->>D1: INSERT INTO sessions (token_hash, user_id)
    Worker-->>Alice: { token: BearerJWT }
    Alice->>Worker: GET /users/0xAlice
    Worker->>Factory: getUserOverview(0xAlice)
    Factory-->>Worker: { cloneAddress, metadata, friendCount }
    Worker-->>Alice: { user: { address, metadata, contract_address } }
```

---

### 2.2 离线同步与消息确认流 (Stage 5)

```mermaid
sequenceDiagram
    autonumber
    participant Alice as Alice Client
    participant Worker as web3-chat-worker
    participant D1 as D1 Database
    participant Bob as Bob Client

    Alice->>Alice: chatEngine.sendMessage(dm, content)
    Alice->>Worker: POST /conversations/:id/messages
    Worker->>D1: INSERT INTO messages (status: 'pending')
    Worker-->>Alice: { message: { id, status: 'sent' } }

    Bob->>Worker: GET /sync?since=lastCheckpoint
    Worker->>D1: SELECT * FROM messages WHERE ... AND created_at > ?
    Worker-->>Bob: { messages: [newMsg], sync_timestamp }
    Bob->>Bob: msgRepo.insertMessage(newMsg)
    Bob->>Worker: POST /messages/:id/read
    Worker->>D1: INSERT INTO message_receipts (status: 'read')

    Alice->>Worker: GET /sync?since=lastCheckpoint
    Worker-->>Alice: { receipts: [{ message_id, status: 'read' }] }
    Alice->>Alice: msgRepo.updateMessageStatus('read')
```

---

### 2.3 语音 30 秒撤回与 R2 物理销毁流 (Stage 6)

```mermaid
sequenceDiagram
    autonumber
    participant Alice as Alice Client
    participant Worker as web3-chat-worker
    participant R2 as R2 Bucket
    participant D1 as D1 Database
    participant Bob as Bob Client

    Alice->>Worker: POST /voice/upload (FormData: audio bytes)
    Worker->>R2: PUT voices/:msgId.opus
    Worker->>D1: INSERT INTO messages + voice_messages
    Worker-->>Alice: { message: { id: mediaMsgId } }

    Bob->>Worker: GET /sync
    Worker-->>Bob: { messages: [mediaMsg] }
    Bob->>Worker: GET /voice/:msgId
    Worker->>R2: GET voices/:msgId.opus
    Worker-->>Bob: HTTP 200 Audio Stream

    Alice->>Worker: POST /messages/:msgId/recall
    Worker->>D1: UPDATE messages SET recalled_at = now, content = '[recalled]'
    Worker->>R2: DELETE voices/:msgId.opus
    Worker-->>Alice: { status: 'recalled' }

    Bob->>Worker: GET /voice/:msgId
    Worker-->>Bob: HTTP 410 Gone (Physical Purged)

    Bob->>Worker: GET /sync
    Worker-->>Bob: { recalls: [{ id: mediaMsgId, recalled_at }] }
    Bob->>Bob: msgRepo.recallMessage(mediaMsgId)
```

---

### 2.4 LuckyDrop Merkle 红包群聊流 (Stage 8)

```mermaid
sequenceDiagram
    autonumber
    participant Alice as Alice Client
    participant Token as MockERC20 (LRPT)
    participant LuckyDrop as LuckyDropProxy
    participant GroupChat as Group Chat (Worker)
    participant Bob as Bob Client

    Alice->>Token: approve(LuckyDropProxy, 20 LRPT)
    Alice->>Alice: buildMerkleTree([Alice: 10, Bob: 10])
    Alice->>LuckyDrop: createPacket(token, amount, merkleRoot)
    LuckyDrop-->>Alice: PacketCreated(packetId: 1)
    Alice->>GroupChat: sendMessage(group:1, { type: 'packet', merkleRoot, proofBob })
    
    Bob->>GroupChat: syncOnce()
    GroupChat-->>Bob: { messages: [packetMessage] }
    Bob->>Bob: verifyProof(proofBob, merkleRoot, leafBob) == true
    Bob->>LuckyDrop: claim(packetId: 1, index: 1, proofBob)
    LuckyDrop->>Token: transfer(Bob, 10 LRPT)
    LuckyDrop-->>Bob: ClaimSuccessful(10 LRPT)
    
    Bob->>LuckyDrop: claim(packetId: 1, index: 1, proofBob) [Retry]
    LuckyDrop-->>Bob: REVERT AlreadyClaimed()
```
