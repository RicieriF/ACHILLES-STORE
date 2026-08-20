import type { PublicCartDTO, PublicMoneyDTO } from "@achilles/domain";
import type { MedusaContainer } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  remoteQueryObjectFromString,
} from "@medusajs/framework/utils";
import {
  addToCartWorkflowId,
  createCartWorkflow,
  deleteLineItemsWorkflowId,
  updateLineItemInCartWorkflowId,
} from "@medusajs/medusa/core-flows";
import { brazilCommerceDefaults } from "@achilles/domain";
import { PublicCatalogService } from "../catalog/service";

type CartRecord = {
  id: string;
  subtotal?: number | string | null;
  items?: Array<{
    id: string;
    product_handle?: string | null;
    product_title?: string | null;
    variant_title?: string | null;
    variant_id?: string | null;
    thumbnail?: string | null;
    quantity: number;
    unit_price: number | string;
    total?: number | string | null;
  }>;
};

type WorkflowEngine = {
  run(id: string, input: { input: Record<string, unknown> }): Promise<unknown>;
};

type RegionService = {
  listRegions(filters: { name: string }): Promise<Array<{ id: string }>>;
};

type SalesChannelService = {
  listSalesChannels(filters: { name: string }): Promise<Array<{ id: string }>>;
};

export class PublicCartError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PublicCartError";
  }
}

export class PublicCartService {
  constructor(private readonly container: MedusaContainer) {}

  async create(): Promise<PublicCartDTO> {
    const [region] = await this.container
      .resolve<RegionService>(Modules.REGION)
      .listRegions({ name: brazilCommerceDefaults.regionName });
    const [salesChannel] = await this.container
      .resolve<SalesChannelService>(Modules.SALES_CHANNEL)
      .listSalesChannels({ name: brazilCommerceDefaults.salesChannelName });
    if (!region || !salesChannel)
      throw new PublicCartError(
        "CART_CONFIGURATION_MISSING",
        "Carrinho indisponível: configuração comercial incompleta",
      );
    const { result } = await createCartWorkflow(this.container).run({
      input: {
        region_id: region.id,
        sales_channel_id: salesChannel.id,
        currency_code: brazilCommerceDefaults.currencyCode,
        locale: "pt-BR",
      },
    });
    return this.retrieve(result.id);
  }

  async retrieve(cartId: string): Promise<PublicCartDTO> {
    return toPublicCart(await this.refetch(cartId));
  }

  async addItem(
    cartId: string,
    variantId: string,
    quantity: number,
  ): Promise<PublicCartDTO> {
    const product = await new PublicCatalogService(
      this.container,
    ).getProductByVariantId(variantId);
    const variant = product?.variants.find((item) => item.id === variantId);
    if (!product || !variant)
      throw new PublicCartError(
        "PRODUCT_NOT_PUBLIC",
        "Produto não está disponível no catálogo público",
      );
    if (!product.available || !variant.available)
      throw new PublicCartError(
        "PRODUCT_UNAVAILABLE",
        "Esta variante está indisponível",
      );
    await this.workflowEngine().run(addToCartWorkflowId, {
      input: { cart_id: cartId, items: [{ variant_id: variantId, quantity }] },
    });
    return this.retrieve(cartId);
  }

  async updateItem(
    cartId: string,
    itemId: string,
    quantity: number,
  ): Promise<PublicCartDTO> {
    await this.workflowEngine().run(updateLineItemInCartWorkflowId, {
      input: { cart_id: cartId, item_id: itemId, update: { quantity } },
    });
    return this.retrieve(cartId);
  }

  async removeItem(cartId: string, itemId: string): Promise<PublicCartDTO> {
    await this.workflowEngine().run(deleteLineItemsWorkflowId, {
      input: { cart_id: cartId, ids: [itemId] },
    });
    return this.retrieve(cartId);
  }

  private workflowEngine(): WorkflowEngine {
    return this.container.resolve<WorkflowEngine>(Modules.WORKFLOW_ENGINE);
  }

  private async refetch(cartId: string): Promise<CartRecord> {
    const remoteQuery = this.container.resolve<
      (query: object) => Promise<unknown[]>
    >(ContainerRegistrationKeys.REMOTE_QUERY);
    const query = remoteQueryObjectFromString({
      entryPoint: "cart",
      variables: { filters: { id: cartId } },
      fields: [
        "id",
        "subtotal",
        "items.id",
        "items.product_handle",
        "items.product_title",
        "items.variant_title",
        "items.variant_id",
        "items.thumbnail",
        "items.quantity",
        "items.unit_price",
        "items.total",
      ],
    });
    const [cart] = (await remoteQuery(query)) as CartRecord[];
    if (!cart)
      throw new PublicCartError("CART_NOT_FOUND", "Carrinho não encontrado");
    return cart;
  }
}

export function toPublicCart(cart: CartRecord): PublicCartDTO {
  const items = (cart.items ?? []).map((item) => {
    const unitPrice = numeric(item.unit_price);
    return {
      id: item.id,
      productSlug: item.product_handle ?? "produto",
      productTitle: item.product_title ?? "Produto",
      variantTitle: item.variant_title ?? "Padrão",
      variantId: item.variant_id ?? "",
      thumbnail: safeThumbnail(item.thumbnail),
      quantity: item.quantity,
      unitPrice: money(unitPrice),
      total: money(numeric(item.total ?? unitPrice * item.quantity)),
    };
  });
  return {
    id: cart.id,
    items,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    subtotal: money(
      numeric(
        cart.subtotal ??
          items.reduce((total, item) => total + item.total.amount, 0),
      ),
    ),
  };
}

function safeThumbnail(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("/")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !["alibaba", "alicdn", "aliexpress"].some((item) =>
        url.hostname.includes(item),
      )
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function numeric(value: number | string): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function money(amount: number): PublicMoneyDTO {
  return {
    amount,
    currencyCode: "brl",
    formatted: new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount),
  };
}
