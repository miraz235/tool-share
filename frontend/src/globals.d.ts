/// <reference types="node" />
// Ambient declarations to expose Node's `process.env` typings (REACT_APP_BACKEND_URL etc.)
// inside the browser bundle.

declare namespace NodeJS {
  interface ProcessEnv {
    REACT_APP_BACKEND_URL: string;
    NODE_ENV: "development" | "production" | "test";
  }
}

// Sidecar TS for the remaining .tsx pages that aren't fully typed yet — none needed,
// every page in /pages now ends in .tsx.

