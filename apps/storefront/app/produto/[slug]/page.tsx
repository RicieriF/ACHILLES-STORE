import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Breadcrumb } from "../../../components/store/breadcrumb";
import {
  Accordion,
  QuantitySelector,
  Tabs,
} from "../../../components/ui/interactive";
import {
  Badge,
  Button,
  Container,
  Price,
  Rating,
} from "../../../components/ui/primitives";
import { demoProducts } from "../../../lib/demo-catalog";

export const dynamicParams = false;
export const generateStaticParams = () =>
  demoProducts.map(({ slug }) => ({ slug }));
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = demoProducts.find((item) => item.slug === slug);
  return {
    title: product?.title ?? "Produto",
    description: product?.description,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = demoProducts.find((item) => item.slug === slug);
  if (!product) notFound();
  const purchasable = product.available && product.price !== null;
  return (
    <main id="conteudo" className="product-page">
      <Container>
        <Breadcrumb
          items={[
            { label: "Início", href: "/" },
            { label: product.category, href: "/#categorias" },
            { label: product.title },
          ]}
        />
        <div className="product-detail">
          <section className="product-gallery" aria-label="Galeria do produto">
            <div className="product-gallery__main">
              <Image
                src={product.image}
                alt={`${product.title} — imagem demonstrativa`}
                fill
                priority
                sizes="(max-width: 800px) 100vw, 56vw"
              />
            </div>
            <div className="product-gallery__thumbs">
              <button aria-label="Imagem 1 selecionada" aria-pressed="true">
                <Image src={product.image} alt="" width={90} height={90} />
              </button>
              <button aria-label="Imagem alternativa — placeholder" disabled>
                <span>Imagem futura</span>
              </button>
            </div>
          </section>
          <section className="product-info">
            <p className="product-card__category">{product.category}</p>
            <h1>{product.title}</h1>
            <Rating />
            <Price
              value={product.price}
              previous={product.previousPrice}
              unavailable={!purchasable}
            />
            <p className="product-info__description">{product.description}</p>
            {product.badge && <Badge>{product.badge}</Badge>}
            <fieldset className="variant-field">
              <legend>Acabamento</legend>
              <button
                className="variant-option is-selected"
                aria-pressed="true"
              >
                Grafite
              </button>
              <button className="variant-option" disabled>
                Oliva — em breve
              </button>
            </fieldset>
            <div className="purchase-row">
              <QuantitySelector disabled={!purchasable} />
              <Button disabled={!purchasable}>
                {purchasable
                  ? "Adicionar ao carrinho — demonstração"
                  : "Indisponível"}
              </Button>
            </div>
            <p className="commercial-note">
              Demonstração visual: carrinho e checkout serão implementados em
              tarefa futura.
            </p>
            <Accordion
              items={[
                {
                  title: "Entrega",
                  content: (
                    <p>
                      Prazo e modalidade serão exibidos somente quando
                      configurados no backend.
                    </p>
                  ),
                },
                {
                  title: "Trocas e devoluções",
                  content: <p>Política comercial em preparação.</p>,
                },
              ]}
            />
          </section>
        </div>
        <section className="product-specs">
          <Tabs
            items={[
              {
                label: "Descrição",
                content: (
                  <p>
                    {product.description} Conteúdo provisório para validar
                    hierarquia e leitura.
                  </p>
                ),
              },
              {
                label: "Especificações",
                content: (
                  <dl>
                    <div>
                      <dt>Material</dt>
                      <dd>A confirmar</dd>
                    </div>
                    <div>
                      <dt>Dimensões</dt>
                      <dd>A confirmar</dd>
                    </div>
                    <div>
                      <dt>Origem de dados</dt>
                      <dd>Fixture local da TASK 007</dd>
                    </div>
                  </dl>
                ),
              },
            ]}
          />
        </section>
      </Container>
    </main>
  );
}
