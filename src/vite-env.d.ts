/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANTHROPIC_API_KEY?: string;
}

declare module '*.md?raw' {
  const content: string;
  export default content;
}
