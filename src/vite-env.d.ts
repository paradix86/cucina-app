/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANTHROPIC_API_KEY?: string;
}

declare const __APP_VERSION__: string | undefined;
declare const __APP_COMMIT__: string | undefined;
declare const __APP_BUILD_DATE__: string | undefined;
declare const __APP_BUILD_ID__: string | undefined;
declare const __SW_CACHE_NAME__: string | undefined;

declare module '*.md?raw' {
  const content: string;
  export default content;
}
