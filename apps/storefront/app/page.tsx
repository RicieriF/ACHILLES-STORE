import Image from "next/image";
import Link from "next/link";
import { CategoryCard } from "../components/store/category-card";
import { ProductCard } from "../components/store/product-card";
import { ArrowIcon } from "../components/ui/icons";
import {
  Container,
  EmptyState,
  ErrorState,
  SectionHeading,
  TrustItem,
} from "../components/ui/primitives";
import {
  homeCategoryLimit,
  homeCategoryMinimum,
  homeFeaturedLimit,
} from "../lib/catalog-config";
import { getPublicCatalog } from "../lib/commerce";
import { simpleKitDefinitions } from "../lib/catalog-taxonomy";

const useLinks = [
  ["Todo dia / EDC", "Organização compacta para a rotina.", "edc"],
  ["Trabalho", "Luz e utilidade para tarefas práticas.", "lanternas"],
  ["Camping", "Essenciais para uma base funcional.", "camping-outdoor"],
  ["Pesca", "Organização para jornadas junto à água.", "camping-outdoor"],
  ["Trilha", "Visibilidade e função com pouco volume.", "lanternas"],
  ["Emergência", "Itens úteis para situações imprevistas.", "camping-outdoor"],
  ["Motorista", "Organização para manter no veículo.", "edc"],
] as const;

export default async function HomePage() {
  const catalog = await getPublicCatalog().catch(() => null);
  const products = catalog?.products ?? [];
  const categories = (catalog?.categories ?? [])
    .filter((category) => category.productCount >= homeCategoryMinimum)
    .slice(0, homeCategoryLimit);
  const availableHandles = new Set(
    categories.map((category) => category.handle),
  );
  const highlights = [...products]
    .sort((left, right) => Number(right.featured) - Number(left.featured))
    .slice(0, homeFeaturedLimit);
  const newest = products.find((product) => product.newArrival) ?? products[0];

  return (
    <main id="conteudo">
      <section className="hero">
        <Image
          src="/images/achilles-field-hero-v2.png"
          alt="Achilles, Pastor Belga Malinois de máscara escura, em uma trilha ao amanhecer"
          fill
          priority
          sizes="100vw"
        />
        <div className="hero__overlay" />
        <Container className="hero__content">
          <p className="eyebrow eyebrow--light">
            LANTERNAS · EDC · CUTELARIA · OUTDOOR
          </p>
          <h1>Equipamentos para ir mais longe.</h1>
          <p>
            Curadoria objetiva para quem prefere função, clareza e confiança em
            cada jornada.
          </p>
          <div className="hero__actions">
            <Link href="#destaques" className="button button--primary">
              Explorar equipamentos <ArrowIcon />
            </Link>
            {categories[0] && (
              <Link
                href={`/categoria/${categories[0].handle}`}
                className="button button--glass"
              >
                Ver {categories[0].title}
              </Link>
            )}
          </div>
        </Container>
      </section>

      <section className="section" id="categorias">
        <Container>
          <SectionHeading
            eyebrow="Catálogo"
            title="Escolha sua próxima rota."
            description="Categorias aparecem somente quando possuem produtos aprovados no catálogo público."
          />
          {categories.length ? (
            <div className="category-grid">
              {categories.map((category) => (
                <CategoryCard
                  key={category.id}
                  title={category.title}
                  subtitle={`${category.productCount} ${category.productCount === 1 ? "produto aprovado" : "produtos aprovados"}`}
                  image={
                    category.image?.url ?? "/images/category-placeholder.svg"
                  }
                  href={`/categoria/${category.handle}`}
                />
              ))}
            </div>
          ) : (
            <EmptyState title="Curadoria em preparação">
              As categorias serão abertas após a aprovação dos primeiros
              produtos.
            </EmptyState>
          )}
        </Container>
      </section>

      <section className="section section--tint" id="destaques">
        <Container>
          <SectionHeading
            eyebrow="Seleção Achilles"
            title="Essenciais bem escolhidos."
            description="Preço, disponibilidade e publicação passam pelos gates comerciais existentes."
          />
          {!catalog ? (
            <ErrorState>
              O catálogo não respondeu. Tente novamente em alguns instantes.
            </ErrorState>
          ) : highlights.length === 0 ? (
            <EmptyState title="Curadoria em preparação">
              Os primeiros equipamentos aparecerão aqui após a revisão
              comercial.
            </EmptyState>
          ) : (
            <div className="product-grid">
              {highlights.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </Container>
      </section>

      <section className="section use-section">
        <Container>
          <SectionHeading
            eyebrow="Escolha pelo uso"
            title="Parta da necessidade."
            description="Os atalhos são exibidos somente quando levam a uma seleção pública existente."
          />
          <div className="use-grid">
            {useLinks.map(([title, copy, handle], index) => (
              <article key={title}>
                <span>0{index + 1}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
                {availableHandles.has(handle) ? (
                  <Link className="text-link" href={`/categoria/${handle}`}>
                    Ver seleção <ArrowIcon />
                  </Link>
                ) : (
                  <small>Em preparação</small>
                )}
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className="collection-band collection-band--dark">
        <Container>
          <p className="eyebrow">Everyday Carry — EDC</p>
          <h2>O essencial, sempre à mão.</h2>
          <p>
            Equipamentos compactos e organização inteligente para o dia a dia.
          </p>
          {availableHandles.has("edc") && (
            <Link className="button button--primary" href="/categoria/edc">
              Explorar EDC <ArrowIcon />
            </Link>
          )}
        </Container>
      </section>
      <section className="collection-band">
        <Container>
          <p className="eyebrow">Camping & Outdoor</p>
          <h2>Menos improviso. Mais campo.</h2>
          <p>
            Equipamentos funcionais para organizar, iluminar e seguir viagem.
          </p>
          {availableHandles.has("camping-outdoor") && (
            <Link
              className="button button--secondary"
              href="/categoria/camping-outdoor"
            >
              Ver Outdoor <ArrowIcon />
            </Link>
          )}
        </Container>
      </section>

      <section className="section kits-section">
        <Container>
          <SectionHeading
            eyebrow="Kits simples"
            title="Combinações com propósito."
            description="A estrutura comercial usa produtos comuns e metadata segura; nenhum bundle ou desconto é presumido."
          />
          <div className="kit-grid">
            {simpleKitDefinitions.map((kit) => (
              <article key={kit}>
                <h3>{kit}</h3>
                <p>Composição em preparação para revisão comercial.</p>
                <span>Em breve</span>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className="editorial" id="sobre-achilles">
        <Container className="editorial__grid">
          <div className="editorial__media">
            <Image
              src="/images/achilles-field-hero-v2.png"
              alt="Achilles atento em uma paisagem montanhosa"
              fill
              sizes="(max-width: 800px) 100vw, 50vw"
            />
          </div>
          <div className="editorial__copy">
            <p className="eyebrow">O espírito Achilles</p>
            <h2>Alerta. Leal. Pronto.</h2>
            <p>
              Achilles inspira uma curadoria atenta e confiável. Sua cabeça
              alongada, orelhas altas, máscara escura e pelagem típica preservam
              uma identidade real — sem transformar a marca em um personagem
              genérico.
            </p>
            <Link href="/institucional/sobre" className="text-link">
              Conheça a Achilles <ArrowIcon />
            </Link>
          </div>
        </Container>
      </section>

      {newest && (
        <section className="section" id="novidades">
          <Container>
            <SectionHeading
              eyebrow="Novidades"
              title="Recém-chegados ao catálogo."
            />
            <div className="new-arrival">
              <div>
                <span className="new-arrival__number">01</span>
                <p className="eyebrow">
                  {newest.categories[0]?.title ?? "Novidade"}
                </p>
                <h3>{newest.title}</h3>
                <p>{newest.shortDescription}</p>
                <Link href={`/produto/${newest.slug}`} className="text-link">
                  Conhecer produto <ArrowIcon />
                </Link>
              </div>
              <Image
                src={newest.images[0]?.url ?? "/images/product-placeholder.svg"}
                alt={newest.title}
                width={620}
                height={620}
              />
            </div>
          </Container>
        </section>
      )}

      <section className="trust" id="principios">
        <Container className="trust__grid">
          <TrustItem icon="01" title="Compra protegida">
            Carrinho, preço e quantidade validados pelo commerce core.
          </TrustItem>
          <TrustItem icon="02" title="Curadoria responsável">
            Itens sensíveis permanecem fora do catálogo até revisão.
          </TrustItem>
          <TrustItem icon="03" title="Entrega transparente">
            Prazo e origem só aparecem quando confirmados.
          </TrustItem>
          <TrustItem icon="04" title="Acompanhamento">
            A jornada de pedido mantém status e rastreio disponíveis.
          </TrustItem>
        </Container>
      </section>
    </main>
  );
}
