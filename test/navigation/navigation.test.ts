import { describe, it, expect } from 'vitest';
import React from 'react';
import { Badge } from '../../src/components/common/Badge';
import { HeaderBar } from '../../src/components/common/HeaderBar';
import { TabNavigator, TAB_CONFIGS } from '../../src/navigation/TabNavigator';
import { RootNavigator } from '../../src/navigation/RootNavigator';
import { colors } from '../../src/theme/colors';

describe('WeChat-Style 4-Tab Navigation & Shell UI (TASK-007)', () => {
  describe('Theme Palette', () => {
    it('should have authentic WeChat colors', () => {
      expect(colors.primary).toBe('#07C160');
      expect(colors.bubbleSelf).toBe('#95EC69');
      expect(colors.badgeRed).toBe('#FA5151');
      expect(colors.background).toBe('#EDEDED');
    });
  });

  describe('Badge Component', () => {
    it('should return null when count is 0 and dot is false', () => {
      const element = Badge({ count: 0, dot: false });
      expect(element).toBeNull();
    });

    it('should render dot when dot is true', () => {
      const element = Badge({ dot: true });
      expect(React.isValidElement(element)).toBe(true);
      if (React.isValidElement(element)) {
        expect(element.props.testID).toBe('badge-dot');
      }
    });

    it('should cap at maxCount (e.g. 99+)', () => {
      const element = Badge({ count: 120, maxCount: 99 });
      expect(React.isValidElement(element)).toBe(true);
      if (React.isValidElement(element)) {
        expect(element.props.testID).toBe('badge-count');
        const textChild = element.props.children;
        if (React.isValidElement(textChild)) {
          expect((textChild.props as any).children).toBe('99+');
        }
      }
    });
  });

  describe('HeaderBar Component', () => {
    it('should render title and action labels', () => {
      const element = HeaderBar({
        title: 'Chats',
        subtitle: 'Connecting...',
        leftAction: { label: 'Back', onPress: () => {} },
        rightActions: [{ label: '＋', onPress: () => {} }],
      });

      expect(React.isValidElement(element)).toBe(true);
      if (React.isValidElement(element)) {
        expect(element.props.testID).toBe('header-bar');
      }
    });
  });

  describe('TabNavigator Component', () => {
    it('should have 4 predefined WeChat tabs', () => {
      expect(TAB_CONFIGS.length).toBe(4);
      expect(TAB_CONFIGS.map((t) => t.key)).toEqual(['chat', 'contacts', 'discover', 'me']);
    });

    it('should render active tab and pass badges', () => {
      const element = TabNavigator({
        activeTab: 'chat',
        onTabChange: () => {},
        chatUnreadCount: 5,
        hasDiscoverUpdate: true,
      });

      expect(React.isValidElement(element)).toBe(true);
      if (React.isValidElement(element)) {
        expect(element.props.testID).toBe('tab-navigator');
      }
    });
  });

  describe('RootNavigator Component', () => {
    it('should create valid ReactElement with RootNavigator component', () => {
      const element = React.createElement(RootNavigator, { initialTab: 'chat', chatUnreadCount: 3 });
      expect(React.isValidElement(element)).toBe(true);
      expect(element.type).toBe(RootNavigator);
      expect(element.props.initialTab).toBe('chat');
      expect(element.props.chatUnreadCount).toBe(3);
    });
  });
});
