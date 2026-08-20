export const developmentCategories = [
  "Iluminação",
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
    category: "Iluminação",
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
] as const;
