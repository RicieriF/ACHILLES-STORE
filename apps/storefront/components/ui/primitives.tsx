import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

export const Container = ({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={`container ${className}`} {...props} />
);
export const Badge = ({
  children,
  tone = "olive",
}: {
  children: ReactNode;
  tone?: "olive" | "sand" | "neutral" | "danger";
}) => <span className={`badge badge--${tone}`}>{children}</span>;
export const Button = ({
  children,
  variant = "primary",
  loading = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
}) => (
  <button
    className={`button button--${variant} ${className}`}
    aria-busy={loading}
    {...props}
  >
    {loading && <span className="spinner" aria-hidden="true" />}
    {children}
  </button>
);
export const IconButton = ({
  label,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
}) => (
  <button className={`icon-button ${className}`} aria-label={label} {...props}>
    {children}
  </button>
);
export const Input = ({
  label,
  error,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
}) => (
  <label className="field" htmlFor={id}>
    <span>{label}</span>
    <input
      id={id}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${id}-error` : undefined}
      {...props}
    />
    {error && (
      <small id={`${id}-error`} className="field__error">
        {error}
      </small>
    )}
  </label>
);
export const Select = ({
  label,
  id,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: ReactNode;
}) => (
  <label className="field" htmlFor={id}>
    <span>{label}</span>
    <select id={id} {...props}>
      {children}
    </select>
  </label>
);
export const Alert = ({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "error" | "success";
}) => (
  <div
    className={`alert alert--${tone}`}
    role={tone === "error" ? "alert" : "status"}
  >
    {children}
  </div>
);
export const Skeleton = ({ className = "" }: { className?: string }) => (
  <span className={`skeleton ${className}`} aria-hidden="true" />
);
export const EmptyState = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <div className="state-panel">
    <strong>{title}</strong>
    <p>{children}</p>
  </div>
);
export const ErrorState = ({ children }: { children: ReactNode }) => (
  <div className="state-panel state-panel--error" role="alert">
    <strong>Não foi possível carregar</strong>
    <p>{children}</p>
  </div>
);
export const SectionHeading = ({
  eyebrow,
  title,
  description,
  action,
  level = 2,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  level?: 1 | 2;
}) => {
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <Heading>{title}</Heading>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
};
export const Price = ({
  value,
  previous,
  unavailable = false,
}: {
  value: string | null;
  previous?: string | undefined;
  unavailable?: boolean;
}) => {
  const displayValue = value?.startsWith("R$") ? value : `R$ ${value ?? ""}`;
  return (
    <div
      className="price"
      aria-label={
        unavailable || !value ? "Preço não disponível" : `Preço ${displayValue}`
      }
    >
      {previous && <s>R$ {previous}</s>}
      <strong>{unavailable || !value ? "Preço em breve" : displayValue}</strong>
    </div>
  );
};
export const Rating = () => (
  <div className="rating" aria-label="Avaliações ainda não disponíveis">
    <span aria-hidden="true">☆☆☆☆☆</span>
    <small>Avaliações em breve</small>
  </div>
);
export const TrustItem = ({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) => (
  <div className="trust-item">
    <span className="trust-item__icon">{icon}</span>
    <div>
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  </div>
);
