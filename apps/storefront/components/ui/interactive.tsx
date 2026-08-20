"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Button, IconButton } from "./primitives";
import { CloseIcon, MinusIcon, PlusIcon, SearchIcon } from "./icons";

export const SearchInput = ({
  placeholder = "Buscar equipamentos",
}: {
  placeholder?: string;
}) => (
  <label className="search-input">
    <span className="sr-only">Buscar</span>
    <SearchIcon />
    <input type="search" placeholder={placeholder} />
  </label>
);
export const QuantitySelector = ({
  disabled = false,
}: {
  disabled?: boolean;
}) => {
  const [quantity, setQuantity] = useState(1);
  return (
    <div className="quantity" aria-label="Quantidade">
      <IconButton
        label="Diminuir quantidade"
        disabled={disabled || quantity === 1}
        onClick={() => {
          setQuantity((value) => Math.max(1, value - 1));
        }}
      >
        <MinusIcon />
      </IconButton>
      <output aria-live="polite">{quantity}</output>
      <IconButton
        label="Aumentar quantidade"
        disabled={disabled}
        onClick={() => {
          setQuantity((value) => value + 1);
        }}
      >
        <PlusIcon />
      </IconButton>
    </div>
  );
};
export const Accordion = ({
  items,
}: {
  items: Array<{ title: string; content: ReactNode }>;
}) => (
  <div className="accordion">
    {items.map((item) => (
      <details key={item.title}>
        <summary>
          {item.title}
          <span aria-hidden="true">+</span>
        </summary>
        <div>{item.content}</div>
      </details>
    ))}
  </div>
);
export const Tabs = ({
  items,
}: {
  items: Array<{ label: string; content: ReactNode }>;
}) => {
  const id = useId();
  const [active, setActive] = useState(0);
  return (
    <div className="tabs">
      <div role="tablist" aria-label="Informações do produto">
        {items.map((item, index) => (
          <button
            id={`${id}-tab-${index}`}
            key={item.label}
            role="tab"
            aria-selected={active === index}
            aria-controls={`${id}-panel-${index}`}
            onClick={() => {
              setActive(index);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        id={`${id}-panel-${active}`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${active}`}
      >
        {items[active]?.content}
      </div>
    </div>
  );
};
export const Drawer = ({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) => {
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("keydown", close);
    };
  }, [open, onClose]);
  return (
    <div
      className={`overlay ${open ? "is-open" : ""}`}
      aria-hidden={!open}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="drawer__head">
          <strong>{title}</strong>
          <IconButton label="Fechar menu" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </div>
        {children}
      </aside>
    </div>
  );
};
export const Modal = ({
  trigger,
  title,
  children,
}: {
  trigger: string;
  title: string;
  children: ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setOpen(true);
        }}
      >
        {trigger}
      </Button>
      {open && (
        <div className="overlay is-open">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="drawer__head">
              <strong>{title}</strong>
              <IconButton
                label="Fechar modal"
                onClick={() => {
                  setOpen(false);
                }}
              >
                <CloseIcon />
              </IconButton>
            </div>
            {children}
          </div>
        </div>
      )}
    </>
  );
};
