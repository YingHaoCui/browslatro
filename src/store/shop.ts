import type { StateCreator } from "zustand";
import type { GameState } from "./game";
import type { ShopItem } from "../items/shop";

type Updater<T> = T | ((prev: T) => T);

function resolve<T>(update: Updater<T>, prev: T): T {
  return typeof update === "function"
    ? (update as (prev: T) => T)(prev)
    : update;
}

export interface ShopState {
  shopRerollCount: number;
  setShopRerollCount: (count: number) => void;
  shopOffers: ReadonlyArray<ShopItem> | null;
  setShopOffers: (update: Updater<ReadonlyArray<ShopItem> | null>) => void;
  resetShop: () => void;
}

export const createShopSlice: StateCreator<GameState, [], [], ShopState> = (
  set,
) => ({
  shopRerollCount: 0,
  setShopRerollCount: (shopRerollCount) => set({ shopRerollCount }),
  shopOffers: null,
  setShopOffers: (update) =>
    set((state) => {
      const shopOffers = resolve(update, state.shopOffers);
      return {
        shopOffers,
        shopRerollCount:
          shopOffers === null || state.shopOffers === null
            ? 0
            : state.shopRerollCount,
      };
    }),
  resetShop: () => set({ shopOffers: null, shopRerollCount: 0 }),
});
