import Image from "next/image";
import Link from "next/link";
import { CategoryCard } from "../components/store/category-card";
import { ProductCard } from "../components/store/product-card";
import { ArrowIcon } from "../components/ui/icons";
import {
  Container,
  SectionHeading,
  TrustItem,
} from "../components/ui/primitives";
import { demoCategories, demoProducts } from "../lib/demo-catalog";

export default function HomePage() {
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
            <Link href="#categorias" className="button button--glass">
              Ver lanternas
            </Link>
          </div>
        </Container>
        <div className="hero__index" aria-hidden="true">
          <span>01</span>
          <i />
          <small>EXPLORE WITH PURPOSE</small>
        </div>
      </section>
      <section className="section" id="categorias">
        <Container>
          <SectionHeading
            eyebrow="Comece por aqui"
            title="Essenciais para o lado de fora."
            description="Poucas categorias, bem selecionadas. A estrutura cresce junto com o catálogo."
          />
          <div className="category-grid">
            {demoCategories.map((category) => (
              <CategoryCard key={category.title} {...category} />
            ))}
          </div>
        </Container>
      </section>
      <section className="section section--tint" id="destaques">
        <Container>
          <SectionHeading
            eyebrow="Seleção Achilles"
            title="Escolhas que fazem sentido."
            description="Demonstração visual com produtos fictícios isolados do catálogo comercial."
            action={
              <Link href="#novidades" className="text-link">
                Ver novidades <ArrowIcon />
              </Link>
            }
          />
          <div className="product-grid">
            {demoProducts.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
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
      <section className="section" id="novidades">
        <Container>
          <SectionHeading
            eyebrow="Recém-chegados"
            title="Novos caminhos começam pequenos."
          />
          <div className="new-arrival">
            <div>
              <span className="new-arrival__number">01</span>
              <p className="eyebrow">Iluminação</p>
              <h3>Uma base visual pronta para receber o catálogo aprovado.</h3>
              <p>
                Nesta etapa, os itens são demonstrações locais. Produtos reais
                só entram quando status, compliance, pricing e canal estiverem
                liberados.
              </p>
            </div>
            <Image
              src="/images/product-light.svg"
              alt="Lanterna demonstrativa em composição gráfica"
              width={620}
              height={620}
            />
          </div>
        </Container>
      </section>
      <section className="trust" id="principios">
        <Container className="trust__grid">
          <TrustItem icon="01" title="Pagamento seguro">
            Estrutura visual preparada; meios de pagamento ainda não estão
            ativos.
          </TrustItem>
          <TrustItem icon="02" title="Produtos selecionados">
            Catálogo interno, curado e sujeito aos gates comerciais.
          </TrustItem>
          <TrustItem icon="03" title="Rastreamento">
            Experiência prevista para uma etapa futura da plataforma.
          </TrustItem>
          <TrustItem icon="04" title="Suporte no Brasil">
            Canal em português previsto para a operação comercial.
          </TrustItem>
        </Container>
      </section>
    </main>
  );
}
