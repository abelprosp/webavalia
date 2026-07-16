export const FOX_AI_QUERY_META = {
  skipGlobalErrorRedirect: true,
} as const

export function isFoxAiQueryKey(queryKey: readonly unknown[]) {
  return queryKey[0] === 'fox-ai'
}
