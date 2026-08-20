"use client";

import type { PublicImageDTO } from "@achilles/domain";
import Image from "next/image";
import { useState } from "react";

export function ProductGallery({
  title,
  images,
}: {
  title: string;
  images: PublicImageDTO[];
}) {
  const gallery =
    images.length > 0
      ? images
      : [
          {
            id: "official-placeholder",
            url: "/images/product-placeholder.svg",
            alt: `${title} — imagem indisponível`,
          },
        ];
  const [active, setActive] = useState(0);
  const selected = gallery[active] ?? gallery[0]!;
  return (
    <section className="product-gallery" aria-label="Galeria do produto">
      <div className="product-gallery__main">
        <Image
          key={selected.id}
          src={selected.url}
          alt={selected.alt}
          fill
          priority
          sizes="(max-width: 800px) 100vw, 56vw"
        />
      </div>
      <div className="product-gallery__thumbs" aria-label="Escolher imagem">
        {gallery.map((image, index) => (
          <button
            key={image.id}
            aria-label={`Ver imagem ${index + 1} de ${gallery.length}`}
            aria-pressed={active === index}
            onClick={() => {
              setActive(index);
            }}
          >
            <Image src={image.url} alt="" width={90} height={90} />
          </button>
        ))}
      </div>
    </section>
  );
}
