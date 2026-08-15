import { describe, it, expect } from 'vitest';
import { generateExtensionZip, generateBookmarkletCode } from '../src/services/extensionGenerator';
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';

describe('Chrome Extension Manifest V3 Package Suite', () => {
  it('generates valid ZIP archive containing all required Manifest V3 assets', async () => {
    const zipBlob = await generateExtensionZip({ appUrl: 'http://localhost:3000' });
    expect(zipBlob).toBeDefined();
    const arrayBuffer = await zipBlob.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    expect(zip.file('manifest.json')).not.toBeNull();
    expect(zip.file('background.js')).not.toBeNull();
    expect(zip.file('popup.html')).not.toBeNull();
    expect(zip.file('popup.js')).not.toBeNull();
    expect(zip.file('sidepanel.html')).not.toBeNull();
    expect(zip.file('sidepanel.js')).not.toBeNull();
    expect(zip.file('icons/icon-16.png')).not.toBeNull();
    expect(zip.file('icons/icon-48.png')).not.toBeNull();
    expect(zip.file('icons/icon-128.png')).not.toBeNull();

    const manifestText = await zip.file('manifest.json')!.async('string');
    const manifest = JSON.parse(manifestText);

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background.service_worker).toBe('background.js');
    expect(manifest.omnibox.keyword).toBe('ol');
    expect(manifest.side_panel.default_path).toBe('sidepanel.html');
    expect(manifest.permissions).toContain('tabs');
    expect(manifest.permissions).toContain('contextMenus');
    expect(manifest.permissions).toContain('sidePanel');
  });

  it('verifies in-repo extension folder matches Manifest V3 standards', () => {
    const extensionDir = path.resolve(__dirname, '../extension');
    expect(fs.existsSync(path.join(extensionDir, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(extensionDir, 'background.js'))).toBe(true);
    expect(fs.existsSync(path.join(extensionDir, 'popup.html'))).toBe(true);
    expect(fs.existsSync(path.join(extensionDir, 'sidepanel.html'))).toBe(true);
    expect(fs.existsSync(path.join(extensionDir, 'icons/icon-16.png'))).toBe(true);
    expect(fs.existsSync(path.join(extensionDir, 'icons/icon-48.png'))).toBe(true);
    expect(fs.existsSync(path.join(extensionDir, 'icons/icon-128.png'))).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(path.join(extensionDir, 'manifest.json'), 'utf-8'));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.omnibox.keyword).toBe('ol');
  });

  it('generates working zero-install bookmarklet code', () => {
    const code = generateBookmarkletCode('http://localhost:3000');
    expect(code.startsWith('javascript:(function()')).toBe(true);
    expect(code).toContain('http://localhost:3000/?url=');
  });
});
