import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, type RenderResult } from 'vitest-browser-react'
import { userEvent, type Locator } from 'vitest/browser'
import { ForgotPasswordForm } from './forgot-password-form'

const forgotPasswordRequestMock = vi.fn()

vi.mock('@/lib/auth-api', () => ({
  forgotPasswordRequest: (...args: unknown[]) =>
    forgotPasswordRequestMock(...args),
}))

describe('ForgotPasswordForm', () => {
  let screen: RenderResult
  let emailInput: Locator
  let continueButton: Locator

  beforeEach(async () => {
    vi.clearAllMocks()
    forgotPasswordRequestMock.mockResolvedValue({
      message:
        'Se o e-mail estiver cadastrado, você receberá instruções em breve.',
    })

    screen = await render(<ForgotPasswordForm />)
    emailInput = screen.getByRole('textbox', { name: /^E-mail$/i })
    continueButton = screen.getByRole('button', { name: /Continuar/i })
  })

  it('renders email field and continue button', async () => {
    await expect.element(emailInput).toBeInTheDocument()
    await expect.element(continueButton).toBeInTheDocument()
  })

  it('shows validation when submitting empty form', async () => {
    await userEvent.click(continueButton)
    await expect
      .element(screen.getByText(/Informe um e-mail válido/i))
      .toBeInTheDocument()
  })

  it('calls forgot password API and resets the form on success', async () => {
    await userEvent.fill(emailInput, 'a@b.com')
    await userEvent.click(continueButton)

    await vi.waitFor(() =>
      expect(forgotPasswordRequestMock).toHaveBeenCalledWith('a@b.com')
    )

    await expect.element(emailInput).toHaveValue('')
  })
})
