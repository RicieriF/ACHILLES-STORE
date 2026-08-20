"use client";

import Link from "next/link";
import { useState } from "react";
import { CartIcon, MenuIcon, SearchIcon, UserIcon } from "../ui/icons";
import { Drawer, SearchInput } from "../ui/interactive";
import { IconButton } from "../ui/primitives";

const links = [
  ["Início", "/"],
  ["Lanternas", "/#destaques"],
  ["Camping", "/#categorias"],
  ["Outdoor", "/#categorias"],
  ["Novidades", "/#novidades"],
] as const;

export const SiteHeader = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="site-header">
        <div className="announcement">
          Curadoria outdoor para uso real <span>•</span> Atendimento em
          português
        </div>
        <div className="container site-header__main">
          <IconButton
            label="Abrir menu"
            className="mobile-only"
            onClick={() => {
              setMenuOpen(true);
            }}
          >
            <MenuIcon />
          </IconButton>
          <Link
            href="/"
            className="wordmark"
            aria-label="Achilles Store — início"
          >
            <span>ACHILLES</span>
            <small>STORE</small>
          </Link>
          <nav className="desktop-nav" aria-label="Navegação principal">
            {links.map(([label, href]) => (
              <Link key={label} href={href}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <IconButton
              label="Buscar"
              onClick={() => {
                setSearchOpen((value) => !value);
              }}
            >
              <SearchIcon />
            </IconButton>
            <IconButton
              label="Conta — em breve"
              className="desktop-only"
              disabled
            >
              <UserIcon />
            </IconButton>
            <IconButton label="Carrinho — em breve" disabled>
              <CartIcon />
              <span className="cart-count">0</span>
            </IconButton>
          </div>
        </div>
        {searchOpen && (
          <div className="container header-search">
            <SearchInput />
          </div>
        )}
      </header>
      <Drawer
        open={menuOpen}
        onClose={() => {
          setMenuOpen(false);
        }}
        title="Menu"
      >
        <nav className="mobile-nav" aria-label="Navegação mobile">
          {links.map(([label, href]) => (
            <Link
              key={label}
              href={href}
              onClick={() => {
                setMenuOpen(false);
              }}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="drawer-search">
          <SearchInput />
        </div>
        <p className="drawer-note">
          Categorias futuras aparecem quando houver produtos públicos
          suficientes.
        </p>
      </Drawer>
    </>
  );
};
