import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import * as cheerio from "cheerio";
import { AppError, NotFoundError } from "@/lib/errors";
import type { ProductRepository } from "./repository";
import { repositories } from "@/server/container";

function isPrivateIp(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  return (
    address === "::1" ||
    address.startsWith("fc") ||
    address.startsWith("fd") ||
    address.startsWith("fe80:")
  );
}

export async function assertPublicUrl(value: string) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new AppError("Unsupported product URL", "INVALID_URL", 422);
  const addresses = await lookup(url.hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some((entry) => isPrivateIp(entry.address))
  )
    throw new AppError(
      "Private network URLs are not allowed",
      "INVALID_URL",
      422,
    );
  return url;
}

function meta($: cheerio.CheerioAPI, ...selectors: string[]) {
  for (const selector of selectors) {
    const value = $(selector).attr("content")?.trim();
    if (value) return value;
  }
}

export async function importProduct(
  input: {
    organizationId: string;
    projectId: string;
    url: string;
  },
  dependency: ProductRepository = repositories.products,
) {
  if (!(await dependency.projectExists(input.projectId, input.organizationId)))
    throw new NotFoundError("Project");
  const url = await assertPublicUrl(input.url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const response = await fetch(url, {
    signal: controller.signal,
    redirect: "error",
    headers: {
      "User-Agent": "AdForgeProductImporter/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
  }).finally(() => clearTimeout(timeout));
  if (!response.ok)
    throw new AppError(
      `Product page returned ${response.status}`,
      "IMPORT_FAILED",
      422,
    );
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > 2_000_000)
    throw new AppError("Product page is too large", "IMPORT_TOO_LARGE", 413);
  const html = (await response.text()).slice(0, 2_000_000);
  const $ = cheerio.load(html);
  const jsonLd = $("script[type='application/ld+json']")
    .toArray()
    .flatMap((el) => {
      try {
        const value = JSON.parse($(el).text());
        return Array.isArray(value) ? value : [value];
      } catch {
        return [];
      }
    });
  const product = jsonLd.find(
    (item: Record<string, unknown>) => item?.["@type"] === "Product",
  ) as Record<string, unknown> | undefined;
  const offers = product?.offers as Record<string, unknown> | undefined;
  const images = [
    product?.image,
    meta($, "meta[property='og:image']", "meta[name='twitter:image']"),
  ]
    .flat()
    .filter((item): item is string => typeof item === "string")
    .map((item) => new URL(item, url).toString())
    .slice(0, 12);
  const name = String(
    product?.name ??
      meta($, "meta[property='og:title']", "meta[name='twitter:title']") ??
      $("h1").first().text() ??
      $("title").text(),
  ).trim();
  const description = String(
    product?.description ??
      meta($, "meta[property='og:description']", "meta[name='description']") ??
      "",
  ).trim();
  if (!name || !description)
    throw new AppError(
      "Could not identify product name and description",
      "IMPORT_PARSE_FAILED",
      422,
    );
  return dependency.upsertImported(input.projectId, url.toString(), {
    name,
    description,
    imageUrls: images,
    price: offers?.price ? String(offers.price) : undefined,
    currency: String(offers?.priceCurrency ?? "USD"),
    metadata: { importedAt: new Date().toISOString(), source: "website" },
  });
}
