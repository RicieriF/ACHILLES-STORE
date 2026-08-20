"use client";

import type { PublicCategoryDTO } from "@achilles/domain";
import Link from "next/link";
import { useState } from "react";
import { useCart } from "../cart/cart-provider";
import { CartIcon, MenuIcon, SearchIcon, UserIcon } from "../ui/icons";
import { Drawer, SearchInput } from "../ui/interactive";
import { IconButton } from "../ui/primitives";

export const SiteHeader = ({
  categories,
}: {
  categories: PublicCategoryDTO[];
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { cart, openCart } = useCart();
  const links = [
    { label: "Início", href: "/" },
    ...categories.slice(0, 4).map((category) => ({
      label: category.title,
      href: `/categoria/${category.handle}`,
    })),
    { label: "Novidades", href: "/#novidades" },
  ];

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
            {links.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
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
            <IconButton label="Abrir carrinho" onClick={openCart}>
              <CartIcon />
              <span className="cart-count">{cart?.itemCount ?? 0}</span>
            </IconButton>
          </div>
        </div>
        {searchOpen && (
          <form
            className="container header-search"
            action="/buscar"
            method="get"
            role="search"
          >
            <SearchInput />
          </form>
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
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => {
                setMenuOpen(false);
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <form
          action="/buscar"
          method="get"
          role="search"
          className="drawer-search"
        >
          <SearchInput />
        </form>
        <p className="drawer-note">
          Categorias aparecem automaticamente quando possuem produtos públicos.
        </p>
      </Drawer>
    </>
  );
};
