import { describe, it, expect } from 'vitest';
import { normalizeSourceDomain, detectSource } from '../../src/lib/import/core';

describe('normalizeSourceDomain', () => {
  it('should extract domain from full URL', () => {
    expect(normalizeSourceDomain('https://www.example.com/path')).toBe('example.com');
  });

  it('should remove www prefix', () => {
    expect(normalizeSourceDomain('https://www.giallozafferano.it/ricette/')).toBe('giallozafferano.it');
  });

  it('should handle different protocols', () => {
    expect(normalizeSourceDomain('http://example.com')).toBe('example.com');
    expect(normalizeSourceDomain('https://example.com')).toBe('example.com');
  });

  it('should normalize youtube variants', () => {
    expect(normalizeSourceDomain('https://www.youtube.com/watch?v=123')).toBe('youtube.com');
    expect(normalizeSourceDomain('https://www.youtu.be/123')).toBe('youtube.com');
    expect(normalizeSourceDomain('https://youtube.com/watch?v=123')).toBe('youtube.com');
  });

  it('should normalize instagram variants', () => {
    expect(normalizeSourceDomain('https://www.instagram.com/user/')).toBe('instagram.com');
    expect(normalizeSourceDomain('https://instagram.com/user/')).toBe('instagram.com');
  });

  it('should normalize tiktok variants', () => {
    expect(normalizeSourceDomain('https://www.tiktok.com/@user')).toBe('tiktok.com');
    expect(normalizeSourceDomain('https://tiktok.com/@user')).toBe('tiktok.com');
  });

  it('should handle multi-level domains', () => {
    expect(normalizeSourceDomain('https://www.example.co.uk')).toBe('example.co.uk');
    expect(normalizeSourceDomain('https://www.example.com.br')).toBe('example.com.br');
    expect(normalizeSourceDomain('https://www.example.com.au')).toBe('example.com.au');
  });

  it('should be case-insensitive', () => {
    expect(normalizeSourceDomain('https://WWW.EXAMPLE.COM')).toBe('example.com');
    expect(normalizeSourceDomain('https://WWW.YOUTUBE.COM')).toBe('youtube.com');
  });

  it('should handle single-level domains', () => {
    expect(normalizeSourceDomain('https://localhost:8000')).toBe('localhost');
  });

  it('should handle invalid URLs gracefully', () => {
    expect(normalizeSourceDomain('not a url')).toBe('');
    expect(normalizeSourceDomain('')).toBe('');
    expect(normalizeSourceDomain(null as any)).toBe('');
  });
});

describe('detectSource', () => {
  it('should detect youtube.com', () => {
    expect(detectSource('https://www.youtube.com/watch?v=123')).toBe('youtube');
    expect(detectSource('https://youtube.com/watch?v=456')).toBe('youtube');
  });

  it('should detect youtu.be', () => {
    expect(detectSource('https://youtu.be/123')).toBe('youtube');
    expect(detectSource('https://www.youtu.be/456')).toBe('youtube');
  });

  it('should detect tiktok.com', () => {
    expect(detectSource('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
    expect(detectSource('https://tiktok.com/@user/video/456')).toBe('tiktok');
  });

  it('should detect instagram.com', () => {
    expect(detectSource('https://www.instagram.com/user/')).toBe('instagram');
    expect(detectSource('https://instagram.com/p/123')).toBe('instagram');
  });

  it('should default to web for other sources', () => {
    expect(detectSource('https://giallozafferano.it/ricette/')).toBe('web');
    expect(detectSource('https://example.com')).toBe('web');
    expect(detectSource('https://blog.example.com/recipes')).toBe('web');
  });

  it('should be case-insensitive', () => {
    expect(detectSource('HTTPS://YOUTUBE.COM/WATCH?V=123')).toBe('youtube');
    expect(detectSource('HTTPS://INSTAGRAM.COM/USER')).toBe('instagram');
  });

  it('should handle URLs with query params and fragments', () => {
    expect(detectSource('https://youtube.com/watch?v=123&t=45s')).toBe('youtube');
    expect(detectSource('https://instagram.com/p/123?utm_source=share')).toBe('instagram');
  });
});
