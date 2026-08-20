import Link from "next/link";
import { Container } from "../ui/primitives";

const groups = [
  [
    "Atendimento",
    ["Fale conosco", "Dúvidas frequentes", "Trocas e devoluções"],
  ],
  ["Institucional", ["Sobre a Achilles", "Curadoria", "Contato"]],
  ["Categorias", ["Lanternas", "Camping", "Outdoor essencial"]],
] as const;
export const SiteFooter = () => (
  <footer className="site-footer">
    <Container>
      <div className="footer-lead">
        <Link href="/" className="wordmark wordmark--light">
          <span>ACHILLES</span>
          <small>STORE</small>
        </Link>
        <p>Equipamentos selecionados para acompanhar jornadas reais.</p>
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
