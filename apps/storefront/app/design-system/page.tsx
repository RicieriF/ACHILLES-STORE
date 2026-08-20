import { notFound } from "next/navigation";
import { ProductCard } from "../../components/store/product-card";
import {
  Accordion,
  Modal,
  QuantitySelector,
  SearchInput,
  Tabs,
} from "../../components/ui/interactive";
import {
  Alert,
  Badge,
  Button,
  Container,
  EmptyState,
  ErrorState,
  Input,
  Price,
  Rating,
  SectionHeading,
  Select,
  Skeleton,
} from "../../components/ui/primitives";
import { designSystemProduct } from "../../lib/demo-catalog";

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const previewProduct = designSystemProduct;
  if (!previewProduct) notFound();
  return (
    <main id="conteudo" className="ds-page">
      <Container>
        <p className="eyebrow">
          Identidade oficial · Ambiente de desenvolvimento
        </p>
        <h1>Achilles Design System</h1>
        <p className="ds-intro">
          Outdoor técnico, premium e moderno. Esta página não é disponibilizada
          na build de produção.
        </p>
        <section className="ds-section">
          <SectionHeading title="Tokens de cor" />
          <div className="swatches">
            {[
              ["Carvão", "#111315"],
              ["Grafite", "#2D3330"],
              ["Coyote", "#B68A58"],
              ["Areia", "#D7C2A4"],
              ["Off-white", "#F4EFE8"],
              ["Oliva", "#4B5542"],
              ["Laranja", "#E96A1A"],
              ["Branco", "#FFFFFF"],
            ].map(([name, color]) => (
              <div key={name}>
                <span style={{ background: color }} />
                <strong>{name}</strong>
                <small>{color}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="ds-section">
          <SectionHeading title="Tipografia" />
          <div className="type-sample">
            <p className="eyebrow">Eyebrow técnico</p>
            <h1>Heading display</h1>
            <h2>Heading de seção</h2>
            <h3>Título de produto</h3>
            <p>
              Texto de corpo desenhado para leitura confortável, hierarquia
              clara e informação objetiva.
            </p>
          </div>
        </section>
        <section className="ds-section">
          <SectionHeading title="Botões e badges" />
          <div className="ds-row">
            <Button>Primário</Button>
            <Button variant="secondary">Secundário</Button>
            <Button variant="ghost">Ghost</Button>
            <Button loading>Carregando</Button>
            <Button disabled>Desabilitado</Button>
            <Badge>Destaque</Badge>
            <Badge tone="sand">Promoção</Badge>
            <Badge tone="neutral">Indisponível</Badge>
          </div>
        </section>
        <section className="ds-section">
          <SectionHeading title="Campos" />
          <div className="ds-fields">
            <Input id="ds-name" label="Nome" placeholder="Seu nome" />
            <Input
              id="ds-error"
              label="E-mail"
              defaultValue="inválido"
              error="Informe um e-mail válido"
            />
            <Select id="ds-select" label="Categoria" defaultValue="camping">
              <option value="camping">Camping</option>
              <option value="light">Lanternas</option>
            </Select>
            <SearchInput />
          </div>
        </section>
        <section className="ds-section">
          <SectionHeading title="Produto e preço" />
          <div className="ds-showcase">
            <ProductCard product={previewProduct} />
            <div>
              <Price value="289,90" previous="329,90" />
              <Rating />
              <QuantitySelector />
              <Price value={null} unavailable />
            </div>
          </div>
        </section>
        <section className="ds-section">
          <SectionHeading title="Feedback e estados" />
          <div className="ds-stack">
            <Alert>Informação contextual para orientar a próxima ação.</Alert>
            <Alert tone="success">Alteração salva com sucesso.</Alert>
            <Alert tone="error">Revise os campos destacados.</Alert>
            <Skeleton className="skeleton--card" />
            <EmptyState title="Nada por aqui">
              O conteúdo aparecerá quando estiver disponível.
            </EmptyState>
            <ErrorState>Tente novamente em alguns instantes.</ErrorState>
          </div>
        </section>
        <section className="ds-section">
          <SectionHeading title="Interações" />
          <div className="ds-stack">
            <Tabs
              items={[
                {
                  label: "Descrição",
                  content: <p>Conteúdo da primeira aba.</p>,
                },
                {
                  label: "Especificações",
                  content: <p>Conteúdo técnico estruturado.</p>,
                },
              ]}
            />
            <Accordion
              items={[
                {
                  title: "Como funciona?",
                  content: <p>Accordion sem biblioteca externa.</p>,
                },
              ]}
            />
            <Modal trigger="Abrir modal" title="Modal demonstrativo">
              <p>Conteúdo acessível e objetivo.</p>
            </Modal>
          </div>
        </section>
      </Container>
    </main>
  );
}
