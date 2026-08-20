export type DemoProduct = {
  slug: string;
  category: string;
  title: string;
  price: string | null;
  previousPrice?: string;
  badge?: "Lançamento" | "Destaque" | "Promoção";
  image: string;
  available: boolean;
  description: string;
};

// Adapter estritamente visual da TASK 007. TASK 008 substituirá esta fonte por Products internos aprovados.
export const demoProducts: DemoProduct[] = [
  {
    slug: "lanterna-trail-x1",
    category: "Lanternas e iluminação",
    title: "Lanterna Trail X1",
    price: "289,90",
    badge: "Destaque",
    image: "/images/product-light.svg",
    available: true,
    description:
      "Iluminação compacta para acampamentos, trilhas e uso cotidiano.",
  },
  {
    slug: "lampiao-camp-lumen",
    category: "Camping",
    title: "Lampião Camp Lumen",
    price: "219,90",
    previousPrice: "249,90",
    badge: "Promoção",
    image: "/images/product-camp.svg",
    available: true,
    description: "Luz ambiente estável para a rotina no camping.",
  },
  {
    slug: "organizador-field-kit",
    category: "Outdoor essencial",
    title: "Organizador Field Kit",
    price: null,
    badge: "Lançamento",
    image: "/images/product-field.svg",
    available: false,
    description: "Organização modular para pequenos equipamentos.",
  },
];

export const demoCategories = [
  {
    title: "Lanternas",
    subtitle: "Iluminação para cada rota",
    image: "/images/category-light.svg",
    href: "#destaques",
  },
  {
    title: "Camping",
    subtitle: "Conforto longe da rotina",
    image: "/images/category-camp.svg",
    href: "#destaques",
  },
  {
    title: "Outdoor",
    subtitle: "Essenciais bem escolhidos",
    image: "/images/category-field.svg",
    href: "#destaques",
  },
];
