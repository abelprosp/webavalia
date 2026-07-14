import { Link } from '@tanstack/react-router'
import { AvaliaBrandMark } from '@/features/auth/components/auth-left-panel'

export function TermsOfUsePage() {
  return (
    <div className='relative min-h-svh bg-background text-foreground'>
      <div className='mx-auto max-w-3xl px-6 py-12 md:py-16'>
        <div className='mb-10 flex flex-col items-center gap-4 text-center'>
          <AvaliaBrandMark />
          <h1 className='text-3xl font-semibold tracking-tight'>Termos de Uso</h1>
          <p className='text-sm text-muted-foreground'>
            Versão 1.0 — última atualização em julho de 2026
          </p>
        </div>

        <article className='prose prose-neutral dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed'>
          <section className='space-y-3'>
            <h2 className='text-lg font-semibold'>1. Aceitação</h2>
            <p>
              Ao criar uma conta na Avalia Imob, você declara ter lido, compreendido
              e aceito estes Termos de Uso. Se não concordar com qualquer disposição,
              não utilize a plataforma.
            </p>
          </section>

          <section className='space-y-3'>
            <h2 className='text-lg font-semibold'>2. Serviço</h2>
            <p>
              A Avalia Imob oferece ferramentas de avaliação imobiliária assistida
              por inteligência artificial, gestão de leads e recursos complementares
              para corretores e imobiliárias. Funcionalidades, limites e preços podem
              ser alterados conforme o plano contratado.
            </p>
          </section>

          <section className='space-y-3'>
            <h2 className='text-lg font-semibold'>3. Cadastro e conta</h2>
            <p>
              Você é responsável pela veracidade dos dados informados no cadastro,
              incluindo e-mail, telefone, CPF ou CNPJ. A conta é pessoal e
              intransferível. É proibido compartilhar credenciais de acesso com
              terceiros.
            </p>
          </section>

          <section className='space-y-3'>
            <h2 className='text-lg font-semibold'>4. Uso permitido</h2>
            <p>
              Você concorda em utilizar a plataforma apenas para fins lícitos
              relacionados à atividade imobiliária, sem violar leis aplicáveis,
              direitos de terceiros ou políticas de uso aceitável da Avalia Imob.
            </p>
          </section>

          <section className='space-y-3'>
            <h2 className='text-lg font-semibold'>5. Conteúdo e resultados de IA</h2>
            <p>
              Avaliações e conteúdos gerados por IA são estimativas e não substituem
              laudos técnicos, pareceres jurídicos ou decisões profissionais. Você
              permanece responsável pela validação das informações antes de
              compartilhá-las com clientes.
            </p>
          </section>

          <section className='space-y-3'>
            <h2 className='text-lg font-semibold'>6. Pagamentos e créditos</h2>
            <p>
              Créditos, assinaturas e compras avulsas seguem as condições exibidas no
              momento da contratação. Salvo disposição legal em contrário, valores
              pagos não são reembolsáveis após a utilização dos créditos.
            </p>
          </section>

          <section className='space-y-3'>
            <h2 className='text-lg font-semibold'>7. Privacidade</h2>
            <p>
              O tratamento de dados pessoais observará a legislação aplicável,
              incluindo a LGPD. Informações de contato e documentos fornecidos no
              cadastro serão utilizados para autenticação, comunicação e operação do
              serviço.
            </p>
          </section>

          <section className='space-y-3'>
            <h2 className='text-lg font-semibold'>8. Suspensão e encerramento</h2>
            <p>
              Podemos suspender ou encerrar contas que violem estes termos, apresentem
              risco à plataforma ou estejam inadimplentes, mediante aviso quando
              aplicável.
            </p>
          </section>

          <section className='space-y-3'>
            <h2 className='text-lg font-semibold'>9. Alterações</h2>
            <p>
              Estes termos podem ser atualizados periodicamente. Alterações relevantes
              serão comunicadas por meios razoáveis. O uso continuado da plataforma após
              a publicação de nova versão constitui aceitação das mudanças.
            </p>
          </section>

          <section className='space-y-3'>
            <h2 className='text-lg font-semibold'>10. Contato</h2>
            <p>
              Dúvidas sobre estes Termos de Uso podem ser encaminhadas pelo canal de
              suporte disponível na plataforma.
            </p>
          </section>
        </article>

        <p className='mt-10 text-center text-sm text-muted-foreground'>
          <Link to='/sign-up' className='text-foreground hover:underline'>
            Voltar ao cadastro
          </Link>
        </p>
      </div>
    </div>
  )
}
