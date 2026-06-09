/// <reference types="node" />
// Ambient declarations to expose Node's `process.env` typings (REACT_APP_BACKEND_URL etc.)
// inside the browser bundle.

declare namespace NodeJS {
  interface ProcessEnv {
    REACT_APP_BACKEND_URL: string;
    NODE_ENV: "development" | "production" | "test";
  }
}
