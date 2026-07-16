/// <reference types="vite/client" />

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: {
      skipGlobalErrorRedirect?: boolean
    }
  }
}
