import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { TabNavigator, type TabKey } from '../navigation/TabNavigator';
import { HeaderBar } from '../components/common/HeaderBar';
import { ConversationListScreen } from '../features/chat/screens/ConversationListScreen';
import { ChatDetailScreen } from '../features/chat/screens/ChatDetailScreen';
import { ContactsScreen } from '../features/contacts/screens/ContactsScreen';
import { AddFriendScreen } from '../features/contacts/screens/AddFriendScreen';
import { DiscoverScreen } from '../features/discover/screens/DiscoverScreen';
import { SignApprovalSheet } from '../features/discover/components/SignApprovalSheet';
import { MeScreen } from '../features/assets/screens/MeScreen';
import { ChainSwitchModal } from '../features/assets/components/ChainSwitchModal';
import { ClaimResultModal } from '../features/packet/components/ClaimResultModal';
import { colors } from '../theme/colors';
import { SUPPORTED_CHAINS } from '../constants/chains';
import {
  type Conversation,
  type ChatMessage,
  type Contact,
  type WalletAccount,
  type ChainConfig,
  type TokenAsset,
  type PacketMessagePayload,
  PacketType,
  FriendStatus,
} from '../types';

export type VisualSceneKey =
  | 'chats'
  | 'chat_detail'
  | 'red_packet_modal'
  | 'contacts'
  | 'add_friend'
  | 'discover'
  | 'sign_sheet'
  | 'me'
  | 'chain_switch';

// --- High-fidelity mock fixtures ---

const MOCK_ACCOUNT: WalletAccount = {
  address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  name: 'Vitalik (Web3 Dev)',
  createdAt: 1726000000,
};

const MOCK_CHAIN: ChainConfig = SUPPORTED_CHAINS[97]; // BSC Testnet

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-alice',
    type: 'dm',
    title: 'Alice (alice.eth)',
    avatar: '👤',
    last_message: '🧧 Sent you a LuckyDrop Red Packet!',
    last_message_at: Math.floor(Date.now() / 1000) - 120,
    unread_count: 2,
    peer_address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    updated_at: Math.floor(Date.now() / 1000) - 120,
  },
  {
    id: 'conv-group-alpha',
    type: 'group',
    title: 'Web3 Builders Alpha (18)',
    avatar: '👥',
    last_message: 'Bob: Did anyone claim the BSC testnet packet?',
    last_message_at: Math.floor(Date.now() / 1000) - 900,
    unread_count: 0,
    group_id: 'group_alpha',
    updated_at: Math.floor(Date.now() / 1000) - 900,
  },
  {
    id: 'conv-satoshi',
    type: 'dm',
    title: 'Satoshi 🔥',
    avatar: '👤',
    last_message: 'Self-destructing secret memo',
    last_message_at: Math.floor(Date.now() / 1000) - 86400,
    unread_count: 0,
    peer_address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
    updated_at: Math.floor(Date.now() / 1000) - 86400,
  },
  {
    id: 'conv-charlie',
    type: 'dm',
    title: 'Charlie (charlie.eth)',
    avatar: '👤',
    last_message: 'BSC transaction confirmed on-chain! 🚀',
    last_message_at: Math.floor(Date.now() / 1000) - 172800,
    unread_count: 0,
    peer_address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    updated_at: Math.floor(Date.now() / 1000) - 172800,
  },
  {
    id: 'conv-vitalik',
    type: 'dm',
    title: 'Vitalik Buterin',
    avatar: '👤',
    last_message: 'Next layer-2 scaling workshop starts at 18:00 UTC',
    last_message_at: Math.floor(Date.now() / 1000) - 259200,
    unread_count: 0,
    peer_address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    updated_at: Math.floor(Date.now() / 1000) - 259200,
  },
  {
    id: 'conv-bnb-devs',
    type: 'group',
    title: 'BNB Chain Core Developers (42)',
    avatar: '👥',
    last_message: 'Alice: BEP-336 Blob transactions are now live on testnet!',
    last_message_at: Math.floor(Date.now() / 1000) - 345600,
    unread_count: 0,
    group_id: 'group_bnb_devs',
    updated_at: Math.floor(Date.now() / 1000) - 345600,
  },
];

const MOCK_PACKET_PAYLOAD: PacketMessagePayload = {
  packetId: '0xpacket_lucky_drop_01',
  chainId: 97,
  tokenSymbol: 'LUCKY',
  totalAmount: '10.0',
  recipientCount: 5,
  wishText: '恭喜发财 大吉大利 🧧',
  packetType: PacketType.FIXED,
};

const MOCK_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    conversation_id: 'conv-alice',
    sender_id: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    type: 'text',
    content: 'Hey! Welcome to Web3 Chat on BSC Testnet 🚀',
    retention: 'permanent',
    status: 'delivered',
    expires_at: 0,
    delivered_at: Math.floor(Date.now() / 1000) - 590,
    read_at: Math.floor(Date.now() / 1000) - 550,
    created_at: Math.floor(Date.now() / 1000) - 600,
  },
  {
    id: 'msg-2',
    conversation_id: 'conv-alice',
    sender_id: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    type: 'text',
    content: 'Thanks Alice! Has the LuckyDrop protocol contract been deployed?',
    retention: 'permanent',
    status: 'delivered',
    expires_at: 0,
    delivered_at: Math.floor(Date.now() / 1000) - 440,
    read_at: Math.floor(Date.now() / 1000) - 400,
    created_at: Math.floor(Date.now() / 1000) - 450,
  },
  {
    id: 'msg-3',
    conversation_id: 'conv-alice',
    sender_id: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    type: 'text',
    content: '🔥 Yes! Here is the contract address. This message will self-destruct in 30 seconds.',
    retention: 'on_read',
    burn_after_seconds: 30,
    status: 'read',
    expires_at: Math.floor(Date.now() / 1000) + 25,
    delivered_at: Math.floor(Date.now() / 1000) - 190,
    read_at: Math.floor(Date.now() / 1000) - 5,
    created_at: Math.floor(Date.now() / 1000) - 200,
  },
  {
    id: 'msg-4',
    conversation_id: 'conv-alice',
    sender_id: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    type: 'packet',
    content: '恭喜发财 大吉大利 🧧',
    metadata: { packet: MOCK_PACKET_PAYLOAD },
    retention: 'permanent',
    status: 'delivered',
    expires_at: 0,
    delivered_at: Math.floor(Date.now() / 1000) - 110,
    read_at: null,
    created_at: Math.floor(Date.now() / 1000) - 120,
  },
  {
    id: 'msg-5',
    conversation_id: 'conv-alice',
    sender_id: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    type: 'text',
    content: 'Awesome! Let me claim that red packet right now.',
    retention: 'permanent',
    status: 'delivered',
    expires_at: 0,
    delivered_at: Math.floor(Date.now() / 1000) - 25,
    read_at: null,
    created_at: Math.floor(Date.now() / 1000) - 30,
  },
];

const MOCK_CONTACTS: Contact[] = [
  {
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    alias: 'Alice',
    ensName: 'alice.eth',
    status: FriendStatus.FRIEND,
  },
  {
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    alias: 'Bob',
    ensName: 'bob.bnb',
    status: FriendStatus.FRIEND,
  },
  {
    address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    alias: 'Charlie',
    ensName: 'charlie.eth',
    status: FriendStatus.FRIEND,
  },
  {
    address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
    alias: 'David',
    status: FriendStatus.FRIEND,
  },
  {
    address: '0x976EA74026E726554dB657fA54763abd0C3a0aa9',
    alias: 'Satoshi Nakamoto',
    ensName: 'satoshi.eth',
    status: FriendStatus.FRIEND,
  },
  {
    address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    alias: 'Vitalik Buterin',
    ensName: 'vitalik.eth',
    status: FriendStatus.FRIEND,
  },
];

const MOCK_ASSETS: TokenAsset[] = [
  {
    address: '0x0000000000000000000000000000000000000000',
    symbol: 'BNB',
    name: 'BNB Native Token',
    decimals: 18,
    balance: '14.5000',
    usdPrice: 580.0,
    chainId: 97,
  },
  {
    address: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 18,
    balance: '3500.0000',
    usdPrice: 1.0,
    chainId: 97,
  },
  {
    address: '0x851c72E09bC92518eA67e9b0d23f37473724c965',
    symbol: 'LUCKY',
    name: 'LuckyDrop Token',
    decimals: 18,
    balance: '1080.0000',
    usdPrice: 0.5,
    chainId: 97,
  },
];

export interface VisualHarnessProps {
  initialScene?: VisualSceneKey;
}

export const VisualHarness: React.FC<VisualHarnessProps> = ({ initialScene = 'chats' }) => {
  const [scene, setScene] = useState<VisualSceneKey>(initialScene);
  const [activeTab, setActiveTab] = useState<TabKey>('chat');
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showChainModal, setShowChainModal] = useState(false);
  const [showSignSheet, setShowSignSheet] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_MESSAGES);

  // Sync with browser URL hash if in Web environment
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleHashChange = () => {
        const hash = (window.location.hash.replace('#', '') || 'chats') as VisualSceneKey;
        setScene(hash);
        setShowClaimModal(hash === 'red_packet_modal');
        setShowSignSheet(hash === 'sign_sheet');
        setShowChainModal(hash === 'chain_switch');

        if (hash === 'chats' || hash === 'chat_detail' || hash === 'red_packet_modal') {
          setActiveTab('chat');
        } else if (hash === 'contacts' || hash === 'add_friend') {
          setActiveTab('contacts');
        } else if (hash === 'discover' || hash === 'sign_sheet') {
          setActiveTab('discover');
        } else if (hash === 'me' || hash === 'chain_switch') {
          setActiveTab('me');
        }
      };

      handleHashChange();
      window.addEventListener('hashchange', handleHashChange);
      return () => window.removeEventListener('hashchange', handleHashChange);
    }
  }, []);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    if (tab === 'chat') setScene('chats');
    else if (tab === 'contacts') setScene('contacts');
    else if (tab === 'discover') setScene('discover');
    else if (tab === 'me') setScene('me');
  };

  const handleSendMessage = (text: string) => {
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      conversation_id: 'conv-alice',
      sender_id: MOCK_ACCOUNT.address,
      type: 'text',
      content: text,
      retention: 'permanent',
      status: 'delivered',
      expires_at: 0,
      delivered_at: null,
      read_at: null,
      created_at: Math.floor(Date.now() / 1000),
    };
    setMessages((prev) => [...prev, newMsg]);
  };

  // Render Sub-Views
  const renderMainContent = () => {
    // 1. Chat Detail Screen
    if (scene === 'chat_detail' || scene === 'red_packet_modal') {
      return (
        <ChatDetailScreen
          conversation={MOCK_CONVERSATIONS[0]}
          messages={messages}
          currentWalletAddress={MOCK_ACCOUNT.address}
          onBack={() => setScene('chats')}
          onSendMessage={handleSendMessage}
          onOpenRedPacket={() => setShowClaimModal(true)}
          onClaimRedPacket={() => setShowClaimModal(true)}
        />
      );
    }

    // 2. Add Friend Screen
    if (scene === 'add_friend') {
      return (
        <AddFriendScreen
          onBack={() => setScene('contacts')}
          onAddFriend={() => {
            setScene('contacts');
          }}
        />
      );
    }

    // 3. Tab Screens
    switch (activeTab) {
      case 'chat':
        return (
          <ConversationListScreen
            conversations={MOCK_CONVERSATIONS}
            onSelectConversation={(conv) => {
              if (conv.id === 'conv-alice') {
                setScene('chat_detail');
              }
            }}
          />
        );
      case 'contacts':
        return (
          <ContactsScreen
            contacts={MOCK_CONTACTS}
            onSelectContact={() => {
              setScene('chat_detail');
            }}
            onOpenNewFriends={() => setScene('add_friend')}
          />
        );
      case 'discover':
        return (
          <DiscoverScreen
            onOpenUrl={() => {
              setShowSignSheet(true);
            }}
          />
        );
      case 'me':
        return (
          <MeScreen
            account={MOCK_ACCOUNT}
            currentChain={MOCK_CHAIN}
            assets={MOCK_ASSETS}
            totalUsd={12450.0}
            onSwitchChain={() => setShowChainModal(true)}
          />
        );
    }
  };

  const isFullscreenSubScreen = scene === 'chat_detail' || scene === 'red_packet_modal' || scene === 'add_friend';

  return (
    <SafeAreaView style={styles.container} testID="visual-harness">
      {/* Tab Header if in Tab Navigation */}
      {!isFullscreenSubScreen && (
        <HeaderBar
          title={
            activeTab === 'chat'
              ? 'Chats'
              : activeTab === 'contacts'
              ? 'Contacts'
              : activeTab === 'discover'
              ? 'Discover'
              : 'Me'
          }
          rightActions={
            activeTab === 'chat' || activeTab === 'contacts'
              ? [{ label: '＋', onPress: () => (activeTab === 'contacts' ? setScene('add_friend') : {}) }]
              : undefined
          }
        />
      )}

      {/* Main Screen Body: Tab screens are nested in TabNavigator, sub-screens in View */}
      {!isFullscreenSubScreen ? (
        <TabNavigator
          activeTab={activeTab}
          onTabChange={handleTabChange}
          chatUnreadCount={2}
          hasDiscoverUpdate={true}
        >
          {renderMainContent()}
        </TabNavigator>
      ) : (
        <View style={styles.body}>
          {renderMainContent()}
        </View>
      )}

      {/* Overlays / Modals */}
      <ClaimResultModal
        visible={showClaimModal || scene === 'red_packet_modal'}
        onClose={() => {
          setShowClaimModal(false);
          if (scene === 'red_packet_modal') setScene('chat_detail');
        }}
        payload={MOCK_PACKET_PAYLOAD}
        claimedAmount="10.00"
      />

      <ChainSwitchModal
        visible={showChainModal || scene === 'chain_switch'}
        currentChainId={97}
        onSelectChain={() => {
          setShowChainModal(false);
          if (scene === 'chain_switch') setScene('me');
        }}
        onClose={() => {
          setShowChainModal(false);
          if (scene === 'chain_switch') setScene('me');
        }}
      />

      <SignApprovalSheet
        visible={showSignSheet || scene === 'sign_sheet'}
        method="personal_sign"
        origin="https://luckydrop.io"
        params={[
          'Welcome to LuckyDrop Protocol! Sign to verify ownership of your wallet.\nNonce: 849204\nTimestamp: 1726300000',
          MOCK_ACCOUNT.address,
        ]}
        onApprove={() => {
          setShowSignSheet(false);
          if (scene === 'sign_sheet') setScene('discover');
        }}
        onReject={() => {
          setShowSignSheet(false);
          if (scene === 'sign_sheet') setScene('discover');
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    height: '100%',
  },
  body: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
