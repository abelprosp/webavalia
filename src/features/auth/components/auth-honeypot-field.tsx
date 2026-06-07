/** Campo oculto para bloquear bots (honeypot). Deve permanecer vazio. */
export function AuthHoneypotField() {
  return (
    <input
      type='text'
      name='_honeypot'
      tabIndex={-1}
      autoComplete='off'
      aria-hidden='true'
      className='pointer-events-none absolute left-[-9999px] h-0 w-0 opacity-0'
      defaultValue=''
    />
  )
}
