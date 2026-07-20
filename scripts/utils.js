import { MODULE_ID } from "./constants.js";

const CURRENCY_TO_GP = { cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 };

export function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(?:a|an|the|some|of)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractCost(text) {
  const match = String(text ?? "").match(/(?:worth|costing)\s+(?:at least\s+)?([\d,]+)\s*(cp|sp|ep|gp|pp)/i);
  if (!match) return 0;
  return Number(match[1].replace(/,/g, "")) * (CURRENCY_TO_GP[match[2].toLowerCase()] ?? 1);
}

export function itemValueInGp(item) {
  const price = item.system?.price ?? {};
  const value = Number(price.value ?? price) || 0;
  return value * (CURRENCY_TO_GP[price.denomination ?? "gp"] ?? 1);
}

export function readMaterial(spell) {
  const system = spell.system ?? {};
  const properties = system.properties;
  const propertyRequired = properties instanceof Set
    ? properties.has("material") || properties.has("m")
    : Array.isArray(properties)
      ? properties.includes("material") || properties.includes("m")
      : Boolean(properties?.material || properties?.m);

  const materials = system.materials ?? {};
  const components = system.components ?? {};
  const text = String(materials.value ?? materials.description ?? components.material ?? components.m?.value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const cost = Number(materials.cost ?? components.materialCost ?? 0) || extractCost(text);
  const consumed = Boolean(materials.consumed ?? components.materialConsumed ?? /\b(?:which|that)\s+(?:the\s+)?spell\s+consumes?\b|\bconsumed\b/i.test(text));

  return {
    required: propertyRequired || components.m === true || components.material === true || Boolean(text),
    text,
    cost,
    consumed
  };
}

export function parseEnglishMaterial(text, material) {
  const consumed = material.consumed || /\b(?:which|that)\s+(?:the\s+)?spell\s+consumes?\b|\bconsumed\b/i.test(text);
  const cost = material.cost || extractCost(text);
  let value = text.trim().replace(/[.]+$/, "");

  value = value
    .replace(/\([^)]*(?:worth|cost|consume)[^)]*\)/gi, " ")
    .replace(/,?\s*(?:which|that)\s+(?:the\s+)?spell\s+consumes?.*$/i, "")
    .replace(/\bworth\s+(?:at least\s+)?[\d,]+\s*(?:cp|sp|ep|gp|pp)\b/gi, "")
    .replace(/\bcosting\s+(?:at least\s+)?[\d,]+\s*(?:cp|sp|ep|gp|pp)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:a|an|the|some)\s+/i, "");

  const descriptive = /\b(?:made of|piece of|bit of|sprig of|drop of|handful of|pinch of|from|inlaid with|filled with)\b/i.test(value);
  const parts = /\b(?:and|or)\b/i.test(value) && !descriptive
    ? value.split(/\s*(?:,|;|\band\b|\bor\b)\s*/i).filter(Boolean)
    : [value];

  const components = parts.map((part, index) => {
    const name = part
      .replace(/^(?:a|an|the|some|a bit of|a piece of|a pinch of|a drop of|a sprig of|a handful of)\s+/i, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, character => character.toUpperCase());

    return name ? {
      name,
      key: normalize(name),
      minimumCost: index === 0 ? cost : 0,
      consumed,
      quantity: 1,
      sourceText: text
    } : null;
  }).filter(Boolean);

  return { components };
}

export function componentItemData(component) {
  return {
    name: component.name,
    type: "loot",
    img: "icons/commodities/materials/powder-grey.webp",
    system: {
      description: { value: `<p>Material spell component.</p><p><strong>Source wording:</strong> ${foundry.utils.escapeHTML(component.sourceText)}</p>` },
      quantity: 1,
      weight: { value: 0, units: "lb" },
      price: { value: component.minimumCost || 0, denomination: "gp" },
      type: { value: "material" }
    },
    flags: { [MODULE_ID]: { componentKey: component.key, minimumCost: component.minimumCost || 0, consumed: component.consumed } }
  };
}
