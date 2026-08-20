import Image from "next/image";
import Link from "next/link";
import type { DemoProduct } from "../../lib/demo-catalog";
import { ArrowIcon } from "../ui/icons";
import { Badge, Price } from "../ui/primitives";

export const ProductCard = ({ product }: { product: DemoProduct }) => (
  <article className="product-card">
    <Link
      href={`/produto/${product.slug}`}
      className="product-card__image"
      aria-label={`Ver ${product.title}`}
    >
      <Image
        src={product.image}
        alt=""
        fill
        sizes="(max-width: 720px) 78vw, (max-width: 1100px) 42vw, 25vw"
      />
      {product.badge && (
        <Badge tone={product.badge === "Promoção" ? "sand" : "olive"}>
          {product.badge}
        </Badge>
      )}
      {!product.available && (
        <span className="product-card__unavailable">Indisponível</span>
      )}
    </Link>
    <div className="product-card__body">
      <p className="product-card__category">{product.category}</p>
      <h3>
        <Link href={`/produto/${product.slug}`}>{product.title}</Link>
      </h3>
      <Price
        value={product.price}
        previous={product.previousPrice}
        unavailable={!product.available}
      />
      <Link href={`/produto/${product.slug}`} className="text-link">
        Ver detalhes <ArrowIcon />
      </Link>
    </div>
  </article>
);
