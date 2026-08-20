import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "../../../components/store/breadcrumb";
import { Container, SectionHeading } from "../../../components/ui/primitives";

const pages = {
  sobre: {
    title: "Sobre a Achilles Store",
    eyebrow: "Nossa identidade",
    paragraphs: [
      "A Achilles Store nasce para selecionar lanternas, EDC, cutelaria e equipamentos outdoor com foco em função, clareza e uso real.",
      "Achilles, nosso Pastor Belga Malinois, representa atenção, confiança e prontidão. A curadoria comercial não substitui a avaliação de uso, segurança ou conformidade de cada produto.",
    ],
  },
  contato: {
    title: "Contato",
    eyebrow: "Atendimento",
    paragraphs: [
      "O canal oficial de atendimento será publicado antes do lançamento comercial.",
      "Esta página não divulga e-mail, telefone ou endereço provisório para evitar direcionar clientes a um canal não monitorado.",
    ],
  },
  entrega: {
    title: "Entrega",
    eyebrow: "Informações de envio",
    paragraphs: [
      "Prazos, origem e modalidade de entrega são apresentados somente quando calculados para o endereço e produto selecionados.",
      "Condições finais de postagem e atendimento ainda precisam de validação operacional antes do go-live.",
    ],
  },
  "trocas-e-devolucoes": {
    title: "Trocas e devoluções",
    eyebrow: "Política provisória",
    paragraphs: [
      "A política final será publicada antes do início das vendas e observará os direitos aplicáveis ao consumidor brasileiro.",
      "Prazos, endereço de devolução e canais responsáveis ainda dependem dos dados finais da operação.",
    ],
  },
  privacidade: {
    title: "Privacidade",
    eyebrow: "Transparência",
    paragraphs: [
      "A loja coleta apenas os dados necessários para operar navegação, carrinho, checkout, pagamento e acompanhamento do pedido.",
      "O controlador, os canais para exercício de direitos e os prazos finais de retenção serão informados antes do go-live.",
    ],
  },
  termos: {
    title: "Termos de uso",
    eyebrow: "Condições provisórias",
    paragraphs: [
      "O catálogo atual é de demonstração e não representa uma oferta comercial definitiva.",
      "Dados empresariais, condições de venda e foro aplicável precisam ser preenchidos e revisados antes do lançamento.",
    ],
  },
} as const;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return Object.keys(pages).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = pages[(await params).slug as keyof typeof pages];
  if (!page) notFound();
  return {
    title: page.title,
    description: page.paragraphs[0],
    alternates: { canonical: `/institucional/${(await params).slug}` },
  };
}

export default async function InstitutionalPage({ params }: Props) {
  const { slug } = await params;
  const page = pages[slug as keyof typeof pages];
  if (!page) notFound();
  return (
    <main id="conteudo" className="institutional-page">
      <Container>
        <Breadcrumb
          items={[{ label: "Início", href: "/" }, { label: page.title }]}
        />
        <SectionHeading level={1} eyebrow={page.eyebrow} title={page.title} />
        <div className="institutional-copy">
          {page.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <aside>
            <strong>Antes do lançamento</strong>
            <p>
              Este conteúdo será revisado com os dados jurídicos e operacionais
              definitivos da Achilles Store.
            </p>
          </aside>
        </div>
      </Container>
    </main>
  );
}
