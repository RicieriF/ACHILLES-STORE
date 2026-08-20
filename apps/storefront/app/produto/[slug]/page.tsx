import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "../../../components/store/breadcrumb";
import { ProductGallery } from "../../../components/store/product-gallery";
import { PurchasePanel } from "../../../components/store/purchase-panel";
import { Accordion, Tabs } from "../../../components/ui/interactive";
import { Badge, Container } from "../../../components/ui/primitives";
import { getPublicProduct } from "../../../lib/commerce";

type ProductPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeSegment(rawSlug);
  const product = await getPublicProduct(slug).catch(() => null);
  if (!product) notFound();
  return {
    title: product.title,
    description: product.shortDescription,
    alternates: { canonical: `/produto/${product.slug}` },
    openGraph: {
      type: "website",
      title: product.title,
      description: product.shortDescription,
      images: product.images[0]
        ? [{ url: product.images[0].url, alt: product.images[0].alt }]
        : [
            {
              url: "/brand/achilles-store-og.svg",
              alt: "Achilles Store",
            },
          ],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug: rawSlug } = await params;
  const slug = decodeSegment(rawSlug);
  const product = await getPublicProduct(slug);
  if (!product) notFound();
  const category = product.categories[0];
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.shortDescription,
    image: product.images.map((image) => image.url),
    offers: {
      "@type": "Offer",
      priceCurrency: "BRL",
      price: product.price.amount,
      availability: product.available
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `/produto/${product.slug}`,
    },
  };

  return (
    <main id="conteudo" className="product-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c"),
        }}
      />
      <Container>
        <Breadcrumb
          items={[
            { label: "Início", href: "/" },
            ...(category
              ? [
                  {
                    label: category.title,
                    href: `/categoria/${category.handle}`,
                  },
                ]
              : []),
            { label: product.title },
          ]}
        />
        <div className="product-detail">
          <ProductGallery title={product.title} images={product.images} />
          <section className="product-info">
            <p className="product-card__category">
              {category?.title ?? "Achilles Store"}
            </p>
            <h1>{product.title}</h1>
            <p className="product-info__description">
              {product.shortDescription}
            </p>
            {product.featured && <Badge>Destaque</Badge>}
            <PurchasePanel variants={product.variants} />
            <p className="commercial-note">
              Prazo de entrega calculado na próxima etapa. Nenhum prazo estimado
              é prometido antes da configuração logística.
            </p>
            <Accordion
              items={[
                {
                  title: "Entrega",
                  content: (
                    <p>
                      Origem, modalidade e prazo serão apresentados quando
                      calculados para o endereço informado.
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
              { label: "Descrição", content: <p>{product.description}</p> },
              {
                label: "Especificações",
                content: (
                  <dl>
                    {product.variants[0]?.options.map((option) => (
                      <div key={option.name}>
                        <dt>{option.name}</dt>
                        <dd>{option.value}</dd>
                      </div>
                    ))}
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

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
