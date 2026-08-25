import { Shell } from "../../components/shell";
const backend = process.env.NEXT_PUBLIC_COMMERCE_URL ?? "http://localhost:9000";
const tools = [
  ["Medusa Admin", `${backend}/app`],
  ["Pricing", `${backend}/app/achilles-pricing`],
  ["Fornecedores", `${backend}/app/achilles-suppliers`],
  ["Compliance", `${backend}/app/achilles-compliance`],
  ["Integration Hub", `${backend}/app/achilles-integrations`],
  ["Extensions", `${backend}/app/achilles-extensions`],
  ["Inventory avançado", `${backend}/app/inventory`],
  ["Sales Channels", `${backend}/app/settings/sales-channels`],
  ["Price Lists", `${backend}/app/price-lists`],
];
export default function Advanced() {
  return (
    <Shell title="Avançado">
      <div className="state">
        <strong>Área técnica</strong>
        <p className="muted">
          Use apenas para manutenção ou com orientação técnica. O Admin Medusa
          permanece disponível como fallback.
        </p>
      </div>
      <div className="grid" style={{ marginTop: 18 }}>
        {tools.map(([name, url]) => (
          <a className="card" href={url} key={name}>
            <h2>{name}</h2>
            <p className="muted">Abrir ferramenta técnica</p>
          </a>
        ))}
      </div>
    </Shell>
  );
}
