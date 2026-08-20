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

export default async function HomePage() {
  const catalog = await getPublicCatalog().catch(() => null);
  const products = catalog?.products ?? [];
  const categories = (catalog?.categories ?? [])
    .filter((category) => category.productCount >= homeCategoryMinimum)
    .slice(0, homeCategoryLimit);
  const highlights = [...products]
    .sort((left, right) => Number(right.featured) - Number(left.featured))
    .slice(0, homeFeaturedLimit);
  const newest = products.find((product) => product.newArrival) ?? products[0];
  const firstCategory = categories[0];

  return (
    <main id="conteudo">
      <section className="hero">
        <Image
          src="/images/hero-outdoor.svg"
          alt="Paisagem abstrata de montanhas ao entardecer"
          fill
          priority
          sizes="100vw"
        />
        <div className="hero__overlay" />
        <Container className="hero__content">
          <p className="eyebrow eyebrow--light">ACHILLES FIELD NOTES · 01</p>
          <h1>
            Equipamentos para <br />
            ir mais longe.
          </h1>
          <p>
            Uma seleção objetiva para iluminar, organizar e aproveitar melhor
            cada saída.
          </p>
          <div className="hero__actions">
            <Link href="#destaques" className="button button--primary">
              Explorar equipamentos <ArrowIcon />
            </Link>
            {firstCategory && (
              <Link
                href={`/categoria/${firstCategory.handle}`}
                className="button button--glass"
              >
                Ver {firstCategory.title}
              </Link>
            )}
          </div>
        </Container>
        <div className="hero__index" aria-hidden="true">
          <span>01</span>
          <i />
          <small>EXPLORE WITH PURPOSE</small>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="section" id="categorias">
          <Container>
            <SectionHeading
              eyebrow="Comece por aqui"
              title="Essenciais para o lado de fora."
              description="Poucas categorias, bem selecionadas. A estrutura cresce junto com o catálogo."
            />
            <div className="category-grid">
              {categories.map((category) => (
                <CategoryCard
                  key={category.id}
                  title={category.title}
                  subtitle={`${category.productCount} ${category.productCount === 1 ? "produto" : "produtos"}`}
                  image={
                    category.image?.url ?? "/images/category-placeholder.svg"
                  }
                  href={`/categoria/${category.handle}`}
                />
              ))}
            </div>
          </Container>
        </section>
      )}

      <section className="section section--tint" id="destaques">
        <Container>
          <SectionHeading
            eyebrow="Seleção Achilles"
            title="Escolhas que fazem sentido."
            description="Somente produtos internos liberados por compliance, pricing e canal comercial."
            action={
              newest ? (
                <Link href="#novidades" className="text-link">
                  Ver novidades <ArrowIcon />
                </Link>
              ) : undefined
            }
          />
          {!catalog ? (
            <ErrorState>
              O catálogo não respondeu. Tente novamente em alguns instantes.
            </ErrorState>
          ) : highlights.length === 0 ? (
            <EmptyState title="Curadoria em preparação">
              Os primeiros equipamentos aparecerão aqui assim que concluírem a
              revisão comercial.
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

      <section className="editorial">
        <Container className="editorial__grid">
          <div className="editorial__media">
            <Image
              src="/images/editorial-field.svg"
              alt="Composição abstrata inspirada em uma jornada outdoor"
              fill
              sizes="(max-width: 800px) 100vw, 50vw"
            />
          </div>
          <div className="editorial__copy">
            <p className="eyebrow">Nossa escolha</p>
            <h2>
              Selecionados <br />
              para uso real.
            </h2>
            <p>
              Menos ruído, mais função. O catálogo da Achilles nasce para ser
              enxuto, compreensível e útil — sem promessas que o produto não
              possa cumprir.
            </p>
            <Link href="#principios" className="text-link">
              Conheça nossos princípios <ArrowIcon />
            </Link>
          </div>
        </Container>
      </section>

      {newest && (
        <section className="section" id="novidades">
          <Container>
            <SectionHeading
              eyebrow="Recém-chegados"
              title="Novos caminhos começam pequenos."
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
          <TrustItem icon="01" title="Carrinho protegido">
            Quantidades e preços são validados pelo commerce core.
          </TrustItem>
          <TrustItem icon="02" title="Produtos selecionados">
            Somente itens aprovados pelos gates comerciais ficam públicos.
          </TrustItem>
          <TrustItem icon="03" title="Entrega transparente">
            Prazo será calculado na próxima etapa, sem promessa fictícia.
          </TrustItem>
          <TrustItem icon="04" title="Atendimento em português">
            Experiência preparada para a operação brasileira.
          </TrustItem>
        </Container>
      </section>
    </main>
  );
}
