import {
  DeleteRequestAxios,
  GetRequestNormal,
  PatchRequestAxios,
  PostRequestAxios,
} from "./api-hooks";
import type { PublicStoreProduct } from "@/lib/public-store";

export type CollectionStoreCatalog = {
  _id: string;
  name: string;
  products?: PublicStoreProduct[];
};

export const getCollectionStoreCatalog = (collectionId: string) =>
  GetRequestNormal<{ data: CollectionStoreCatalog }>(
    `/store/collection/${collectionId}/catalog`,
  );

export async function ensureCollectionStoreCatalog(
  collectionId: string,
  minimumOrderAmount: number,
) {
  const [result, error] = await PostRequestAxios<{ data: CollectionStoreCatalog }>(
    `/store/collection/${collectionId}/catalog/ensure`,
    { minimumOrderAmount },
  );
  if (error || !result?.data?._id) {
    throw new Error(error?.message || "Catalog setup failed");
  }
  return result.data;
}

export async function addCollectionStoreProduct(
  collectionId: string,
  payload: Record<string, unknown>,
) {
  const [result, error] = await PostRequestAxios<{ data: PublicStoreProduct }>(
    `/store/collection/${collectionId}/products`,
    payload,
  );
  if (error || !result) throw new Error(error?.message || "Unable to create product");
  return result.data;
}

export async function editCollectionStoreProduct(
  collectionId: string,
  productId: string,
  patch: Record<string, unknown>,
) {
  const [, error] = await PatchRequestAxios<any>(
    `/store/collection/${collectionId}/products/${productId}`,
    patch,
  );
  if (error) throw new Error(error.message);
}

export async function hideCollectionStoreProduct(
  collectionId: string,
  productId: string,
) {
  const [, error] = await DeleteRequestAxios<any>(
    `/store/collection/${collectionId}/products/${productId}`,
  );
  if (error) throw new Error(error.message);
}
