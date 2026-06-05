/** Caminho interno da rota para redirecionamento pós-login (TanStack Router). */
export function getAuthRedirectPath(location: { href: string }) {
  const href = location.href
  return href.startsWith('/') ? href : '/'
}
