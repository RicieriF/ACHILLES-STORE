import Image from "next/image";
import Link from "next/link";
import type { PublicProductDTO } from "@achilles/domain";
import { ArrowIcon } from "../ui/icons";
import { Badge, Price } from "../ui/primitives";

export const ProductCard = ({ product }: { product: PublicProductDTO }) => (
  <article className="product-card">
    <Link
      href={`/produto/${product.slug}`}
      className="product-card__image"
      aria-label={`Ver ${product.title}`}
    >
      <Image
        src={product.images[0]?.url ?? "/images/product-placeholder.svg"}
        alt=""
        fill
        sizes="(max-width: 720px) 78vw, (max-width: 1100px) 42vw, 25vw"
      />
      {(product.featured || product.newArrival) && (
        <Badge tone="olive">{product.featured ? "Destaque" : "Novidade"}</Badge>
      )}
      {product.shippingOrigin === "BRAZIL" && (
        <span className="product-card__origin">Envio do Brasil</span>
      )}
      {!product.available && (
        <span className="product-card__unavailable">Indisponível</span>
      )}
    </Link>
    <div className="product-card__body">
      <p className="product-card__category">
        {product.categories[0]?.title ?? "Achilles Store"}
      </p>
      <h3>
        <Link href={`/produto/${product.slug}`}>{product.title}</Link>
      </h3>
      <Price value={product.price.formatted} unavailable={!product.available} />
      <Link href={`/produto/${product.slug}`} className="text-link">
        Ver detalhes <ArrowIcon />
      </Link>
    </div>
  </article>
);
