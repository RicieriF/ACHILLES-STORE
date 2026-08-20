import type { PublicCategoryDTO } from "@achilles/domain";
import Link from "next/link";
import { Container } from "../ui/primitives";
import { BrandLogo } from "./brand-logo";

const groups = [
  [
    "Atendimento",
    ["Fale conosco", "Dúvidas frequentes", "Trocas e devoluções"],
  ],
  ["Institucional", ["Sobre a Achilles", "Curadoria", "Contato"]],
] as const;
export const SiteFooter = ({
  categories,
}: {
  categories: PublicCategoryDTO[];
}) => (
  <footer className="site-footer">
    <Container>
      <div className="footer-lead">
        <Link
          href="/"
          className="footer-brand"
          aria-label="Achilles Store — início"
        >
          <BrandLogo variant="monochrome" />
        </Link>
        <p>
          Outdoor, EDC e equipamentos selecionados para acompanhar jornadas
          reais.
        </p>
      </div>
      <div className="footer-grid">
        {groups.map(([title, links]) => (
          <div key={title}>
            <strong>{title}</strong>
            {links.map((label) => (
              <a
                key={label}
                href="#footer"
                aria-label={`${label} — conteúdo futuro`}
              >
                {label}
              </a>
            ))}
          </div>
        ))}
        <div>
          <strong>Categorias</strong>
          {categories.length === 0 ? (
            <span>Curadoria em preparação</span>
          ) : (
            categories.slice(0, 5).map((category) => (
              <Link key={category.id} href={`/categoria/${category.handle}`}>
                {category.title}
              </Link>
            ))
          )}
        </div>
        <div>
          <strong>Redes sociais</strong>
          <a href="#footer">Instagram — em breve</a>
          <a href="#footer">YouTube — em breve</a>
        </div>
      </div>
      <div className="footer-bottom" id="footer">
        <span>© 2026 Achilles Store</span>
        <span>Políticas em preparação para operação comercial.</span>
      </div>
    </Container>
  </footer>
);
