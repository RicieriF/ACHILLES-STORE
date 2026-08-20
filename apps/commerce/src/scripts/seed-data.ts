export const developmentCategories = [
  "Lanternas",
  "Everyday Carry — EDC",
  "Cutelaria",
  "Camping & Outdoor",
  "Camping",
  "Pesca",
  "Mochilas e Bolsas",
  "Outdoor e Aventura",
] as const;

export const developmentProducts = [
  {
    title: "[FICTÍCIO] Lanterna de Desenvolvimento",
    handle: "ficticio-lanterna-desenvolvimento",
    description:
      "Produto inteiramente fictício criado somente para validar o commerce core local.",
    category: "Lanternas",
    sku: "DEV-LANTERNA-001",
    priceBrl: 149,
  },
  {
    title: "[FICTÍCIO] Mochila de Desenvolvimento",
    handle: "ficticio-mochila-desenvolvimento",
    description:
      "Produto inteiramente fictício criado somente para validar variantes e persistência local.",
    category: "Mochilas e Bolsas",
    sku: "DEV-MOCHILA-001",
    priceBrl: 299,
  },
  {
    title: "[FICTÍCIO] Canivete em Revisão",
    handle: "ficticio-canivete-em-revisao",
    description:
      "Produto inteiramente fictício mantido fora do catálogo público até revisão de compliance.",
    category: "Cutelaria",
    sku: "DEV-CUTELARIA-REVIEW-001",
    priceBrl: 199,
  },
] as const;
