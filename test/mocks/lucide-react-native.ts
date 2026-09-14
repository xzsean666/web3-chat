import React from 'react';
import { View } from 'react-native';

const createMockIcon = (name: string) => {
  const MockIcon = (props: any) => React.createElement(View, { ...props, 'data-icon': name });
  MockIcon.displayName = name;
  return MockIcon;
};

// Export explicit named icons used in Icon.tsx
export const MessageSquare = createMockIcon('MessageSquare');
export const MessageCircle = createMockIcon('MessageCircle');
export const Users = createMockIcon('Users');
export const Compass = createMockIcon('Compass');
export const User = createMockIcon('User');
export const ChevronLeft = createMockIcon('ChevronLeft');
export const ChevronRight = createMockIcon('ChevronRight');
export const Plus = createMockIcon('Plus');
export const MoreHorizontal = createMockIcon('MoreHorizontal');
export const Search = createMockIcon('Search');
export const Flame = createMockIcon('Flame');
export const Gift = createMockIcon('Gift');
export const Clock = createMockIcon('Clock');
export const Send = createMockIcon('Send');
export const Check = createMockIcon('Check');
export const CheckCheck = createMockIcon('CheckCheck');
export const UserPlus = createMockIcon('UserPlus');
export const Tag = createMockIcon('Tag');
export const ArrowDownLeft = createMockIcon('ArrowDownLeft');
export const ArrowUpRight = createMockIcon('ArrowUpRight');
export const Wallet = createMockIcon('Wallet');
export const Copy = createMockIcon('Copy');
export const ShieldCheck = createMockIcon('ShieldCheck');
export const ShieldAlert = createMockIcon('ShieldAlert');
export const ExternalLink = createMockIcon('ExternalLink');
export const RefreshCw = createMockIcon('RefreshCw');
export const X = createMockIcon('X');
export const Coins = createMockIcon('Coins');
export const Sparkles = createMockIcon('Sparkles');
export const Globe = createMockIcon('Globe');
export const Layers = createMockIcon('Layers');
export const HelpCircle = createMockIcon('HelpCircle');

export type LucideIcon = React.FC<any>;

const proxyHandler = {
  get: (target: any, prop: string | symbol) => {
    if (typeof prop === 'string') {
      return createMockIcon(prop);
    }
    return undefined;
  },
};

const proxy = new Proxy({}, proxyHandler);
export default proxy;
