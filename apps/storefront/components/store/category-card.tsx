import Link from "next/link";
import { ArrowIcon } from "../ui/icons";
import { SafeProductImage } from "./safe-product-image";

export const CategoryCard = ({
  title,
  subtitle,
  image,
  href,
}: {
  title: string;
  subtitle: string;
  image: string;
  href: string;
}) => (
  <Link href={href} className="category-card">
    <SafeProductImage
      src={image}
      alt=""
      fill
      sizes="(max-width: 720px) 90vw, 33vw"
    />
    <span className="category-card__shade" />
    <span className="category-card__copy">
      <small>{subtitle}</small>
      <strong>{title}</strong>
      <ArrowIcon />
    </span>
  </Link>
);
