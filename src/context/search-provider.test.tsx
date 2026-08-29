import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, type RenderResult } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { SearchProvider } from '@/context/search-provider'

const COMMAND_MENU_PLACEHOLDER = 'Digite um comando ou busque…'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  authUser: null as null | {
    id: string
    name: string
    email: string
    role: 'corretor' | 'admin'
    accountType: 'pf' | 'pj'
  },
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  }
})

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (
    selector?: (state: { auth: { user: typeof mocks.authUser } }) => unknown
  ) => {
    const state = { auth: { user: mocks.authUser } }
    return selector ? selector(state) : state
  },
}))

type ShortcutModifier = 'Control' | 'Meta'

async function renderWithSearchProvider() {
  return await render(<SearchProvider>{null}</SearchProvider>)
}

/**
 * Open the palette by shortcut, retrying while the keydown listener may not be mounted yet.
 * Waits between attempts so a successful toggle is not immediately undone by a second chord.
 */
async function openCommandPalette(
  screen: RenderResult,
  modifier: ShortcutModifier = 'Control'
) {
  await vi.waitFor(
    async () => {
      const isCommandPaletteOpen =
        document.querySelector(
          `[placeholder="${COMMAND_MENU_PLACEHOLDER}"]`
        ) !== null

      if (!isCommandPaletteOpen) {
        await userEvent.keyboard(`{${modifier}>}k{/${modifier}}`)
      }

      await expect
        .element(screen.getByPlaceholder(COMMAND_MENU_PLACEHOLDER))
        .toBeInTheDocument()
    },
    { interval: 50, timeout: 5000 }
  )
}

describe('SearchProvider and CommandMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authUser = null
  })

  it('renders the command palette when the palette is open', async () => {
    const screen = await renderWithSearchProvider()
    const { getByPlaceholder, getByText } = screen

    await openCommandPalette(screen)

    await expect
      .element(getByPlaceholder(COMMAND_MENU_PLACEHOLDER))
      .toBeInTheDocument()
    await expect.element(getByText('Início')).toBeInTheDocument()
    await expect.element(getByText('Avaliar imóvel')).toBeInTheDocument()
    await expect.element(getByText('Perfil')).toBeInTheDocument()
  })

  it('does not show the dialog content when search is closed', async () => {
    const { getByPlaceholder } = await renderWithSearchProvider()

    await expect
      .element(getByPlaceholder(COMMAND_MENU_PLACEHOLDER))
      .not.toBeInTheDocument()
  })

  it.each([
    ['Ctrl', 'Control'],
    ['Cmd', 'Meta'],
  ] as const)(
    'opens the command menu when %s + K is pressed',
    async (_label, modifier) => {
      const screen = await renderWithSearchProvider()

      await expect
        .element(screen.getByPlaceholder(COMMAND_MENU_PLACEHOLDER))
        .not.toBeInTheDocument()

      await openCommandPalette(screen, modifier)

      await expect
        .element(screen.getByPlaceholder(COMMAND_MENU_PLACEHOLDER))
        .toBeInTheDocument()
    }
  )

  it('navigates to a top-level route and closes the palette when a nav item is selected', async () => {
    const screen = await renderWithSearchProvider()

    await openCommandPalette(screen)

    await userEvent.click(screen.getByText('Avaliar imóvel'))

    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/avaliacao' })
    await expect
      .element(screen.getByPlaceholder(COMMAND_MENU_PLACEHOLDER))
      .not.toBeInTheDocument()
  })

  it('navigates for broker sidebar items in the command palette', async () => {
    mocks.authUser = {
      id: '1',
      name: 'Broker',
      email: 'broker@test.com',
      role: 'corretor',
      accountType: 'pj',
    }

    const screen = await renderWithSearchProvider()
    const { getByPlaceholder, getByRole, queryByText } = screen

    await openCommandPalette(screen)

    await expect.element(queryByText('Radar de captação')).not.toBeInTheDocument()
    await expect.element(queryByText('Assistente IA')).not.toBeInTheDocument()

    await userEvent.click(getByRole('option', { name: /Pipeline \(CRM\)/i }))

    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/crm' })
    await expect
      .element(getByPlaceholder(COMMAND_MENU_PLACEHOLDER))
      .not.toBeInTheDocument()
  })

  it('shows empty state when the filter matches nothing', async () => {
    const screen = await renderWithSearchProvider()

    await openCommandPalette(screen)

    await userEvent.fill(
      screen.getByPlaceholder(COMMAND_MENU_PLACEHOLDER),
      'zzzz-no-match-xxxx'
    )

    await expect
      .element(screen.getByText('Nenhum resultado encontrado.'))
      .toBeInTheDocument()
  })
})
