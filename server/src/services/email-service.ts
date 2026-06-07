import nodemailer from 'nodemailer'
import { config } from '../config.js'

let transporter: nodemailer.Transporter | null = null

export function isSmtpConfigured() {
  return Boolean(config.smtp.user && config.smtp.pass && config.smtp.from)
}

function getTransporter() {
  if (!isSmtpConfigured()) {
    throw new Error(
      'Serviço de e-mail indisponível. Configure SMTP_USER e SMTP_PASS no server/.env'
    )
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    })
  }

  return transporter
}

export async function sendEmail(input: {
  to: string
  subject: string
  html: string
  text: string
}) {
  const mailer = getTransporter()

  await mailer.sendMail({
    from: `"${config.smtp.fromName}" <${config.smtp.from}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  })
}

export async function verifySmtpConnection() {
  if (!isSmtpConfigured()) return false
  const mailer = getTransporter()
  await mailer.verify()
  return true
}
