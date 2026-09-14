import { describe, it, expect } from 'vitest';
import React from 'react';
import App from '../App';
import appConfig from '../app.json';
import pkg from '../package.json';

describe('Project Scaffolding Sanity', () => {
  it('should have valid package.json with project name and scripts', () => {
    expect(pkg.name).toBe('web3-chat');
    expect(pkg.scripts.typecheck).toBe('tsc --noEmit');
    expect(pkg.scripts.test).toBe('vitest run');
  });

  it('should have valid app.json Expo config targeting Web3 Chat', () => {
    expect(appConfig.expo.name).toBe('Web3 Chat');
    expect(appConfig.expo.slug).toBe('web3-chat');
  });

  it('should export App as a valid React component function', () => {
    expect(typeof App).toBe('function');
    const element = App();
    expect(React.isValidElement(element)).toBe(true);
    expect(element.type).toBeDefined();
  });
});
