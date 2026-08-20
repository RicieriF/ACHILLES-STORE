import Link from "next/link";

export const Breadcrumb = ({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) => (
  <nav aria-label="Breadcrumb">
    <ol className="breadcrumb">
      {items.map((item, index) => (
        <li key={item.label}>
          {item.href ? (
            <Link href={item.href}>{item.label}</Link>
          ) : (
            <span aria-current="page">{item.label}</span>
          )}
          {index < items.length - 1 && <span aria-hidden="true">/</span>}
        </li>
      ))}
    </ol>
  </nav>
);
