/// <reference types="node" />
// Ambient declarations to expose Node's `process.env` typings (REACT_APP_BACKEND_URL etc.)
// inside the browser bundle.

declare namespace NodeJS {
  interface ProcessEnv {
    REACT_APP_BACKEND_URL: string;
    NODE_ENV: "development" | "production" | "test";
  }
}

// Shims for remaining .jsx page modules until they're migrated to .tsx.
// These keep `import X from "@/pages/X"` from raising TS2307 in the dev console
// while still letting babel-loader / webpack resolve the actual .jsx implementation.
declare module "@/pages/Landing";
declare module "@/pages/ListTool";
declare module "@/pages/Login";
declare module "@/pages/Register";
declare module "@/pages/AIAssistant";
declare module "@/pages/Messages";

