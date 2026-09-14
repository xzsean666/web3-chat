import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import {
  MessageSquare,
  MessageCircle,
  Users,
  Compass,
  User,
  ChevronLeft,
  ChevronRight,
  Plus,
  MoreHorizontal,
  Search,
  Flame,
  Gift,
  Clock,
  Send,
  Check,
  CheckCheck,
  UserPlus,
  Tag,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Copy,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
  RefreshCw,
  X,
  Coins,
  Sparkles,
  Globe,
  Layers,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react-native';

export type IconName =
  | 'chat'
  | 'chat-bubble'
  | 'contacts'
  | 'discover'
  | 'me'
  | 'chevron-left'
  | 'chevron-right'
  | 'plus'
  | 'more'
  | 'search'
  | 'flame'
  | 'gift'
  | 'clock'
  | 'send'
  | 'check'
  | 'check-check'
  | 'user-plus'
  | 'tag'
  | 'arrow-down-left'
  | 'arrow-up-right'
  | 'wallet'
  | 'copy'
  | 'shield-check'
  | 'shield-alert'
  | 'external-link'
  | 'refresh'
  | 'close'
  | 'coins'
  | 'sparkles'
  | 'globe'
  | 'layers';

const ICON_MAP: Record<IconName, LucideIcon> = {
  chat: MessageSquare,
  'chat-bubble': MessageCircle,
  contacts: Users,
  discover: Compass,
  me: User,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  plus: Plus,
  more: MoreHorizontal,
  search: Search,
  flame: Flame,
  gift: Gift,
  clock: Clock,
  send: Send,
  check: Check,
  'check-check': CheckCheck,
  'user-plus': UserPlus,
  tag: Tag,
  'arrow-down-left': ArrowDownLeft,
  'arrow-up-right': ArrowUpRight,
  wallet: Wallet,
  copy: Copy,
  'shield-check': ShieldCheck,
  'shield-alert': ShieldAlert,
  'external-link': ExternalLink,
  refresh: RefreshCw,
  close: X,
  coins: Coins,
  sparkles: Sparkles,
  globe: Globe,
  layers: Layers,
};

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 20,
  color = '#111111',
  strokeWidth = 2,
  style,
}) => {
  const Component = ICON_MAP[name] || HelpCircle;

  return (
    <View style={[styles.container, style]}>
      <Component size={size} color={color} strokeWidth={strokeWidth} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
