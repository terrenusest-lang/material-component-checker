const MODULE_ID = "material-component-checker";
const COMPONENT_PACK = "world.material-components";
const INDEX_SETTING = "spellComponentIndex";
const POUCH_KEY = "spell-component-pouch";
const PENDING_COMPONENTS = new WeakMap();

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, INDEX_SETTING, { scope: "world", config: false, type: Object, default: {} });
  game.settings.register(MODULE_ID, "manualReview", { scope: "world", config: false, type: Array, default: [] });

  game.settings.register(MODULE_ID, "mode", {
    name: "Checking mode",
    hint: "Choose how strictly material components are checked.",
    scope: "world",
    config: true,
    type: String,
    choices: {
      raw: "Rules as written",
      strict: "Always require the actual item",
      costly: "Check only costly or consumed components"
    },
    default: "raw"
  });

  game.settings.register(MODULE_ID, "gmBypass", {
    name: "Allow GM bypass",
    hint: "Casts initiated by a GM are not blocked.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "allowLooseComponents", {
    name: "Allow loose material components",
    hint: "When disabled, generated components must be stored inside a Spell Component Pouch.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "consumeComponents", {
    name: "Consume components automatically",
    hint: "Decrease quantity after a successful cast when the spell consumes the component.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.registerMenu(MODULE_ID, "scanner", {
    name: "Material Component Scanner",
    label: "Scan spell compendiums",
    hint: "Extract English material components and build the Material Components compendium.",
    icon: "fas fa-flask",
    type: MaterialScannerApp,
    restricted: true
  });
});

Hooks.once("ready", () => {
  if (game.system.id !== "dnd5e") {
    ui.notifications.warn("Material Component Checker supports only D&D5e.");
    return;
  }
  Hooks.on("dnd5e.preUseActivity", preUseActivity);
  Hooks.on("dnd5e.postUseActivity", postUseActivity);
  console.log(`${MODULE_ID} | Ready for Foundry VTT 14`);
});

class MaterialScannerApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "mcc-scanner",
    window: { title: "Material Component Scanner", icon: "fas fa-flask", resizable: true },
    position: { width: 620, height: "auto" }
  };

  async _renderHTML() {
    const packs = game.packs
      .filter(pack => pack.documentName === "Item")
      .map(pack => ({
        id: pack.collection,
        title: foundry.utils.escapeHTML(pack.title),
        package: foundry.utils.escapeHTML(pack.metadata.packageName ?? pack.metadata.package ?? "world")
      }))
      .sort((a, b) => a.title.localeCompare(b.title));

    const count = Object.keys(game.settings.get(MODULE_ID, INDEX_SETTING) ?? {}).length;
    const rows = packs.map(pack => `
      <label style="display:flex;gap:.5rem;align-items:center;padding:.2rem 0">
        <input type="checkbox" name="packs" value="${foundry.utils.escapeHTML(pack.id)}">
        <span><strong>${pack.title}</strong> <small>(${pack.package})</small></span>
      </label>`).join("");

    return `
      <form style="padding:1rem">
        <p>Indexed spells: <strong>${count}</strong></p>
        <p>Select English Item compendiums containing D&D5e spells.</p>
        <div style="display:flex;gap:.5rem;margin-bottom:.75rem">
          <button type="button" data-mcc-action="select-all"><i class="fas fa-check-double"></i> Select all</button>
          <button type="button" data-mcc-action="clear-all"><i class="fas fa-times"></i> Clear</button>
        </div>
        <fieldset style="max-height:360px;overflow:auto">${rows || "<p>No Item compendiums found.</p>"}</fieldset>
        <p data-role="status" style="min-height:1.5rem"></p>
        <button type="button" data-mcc-action="scan"><i class="fas fa-flask"></i> Scan selected compendiums</button>
      </form>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;
    root.querySelector('[data-mcc-action="select-all"]')?.addEventListener("click", () => {
      root.querySelectorAll('input[name="packs"]').forEach(input => input.checked = true);
    });
    root.querySelector('[data-mcc-action="clear-all"]')?.addEventListener("click", () => {
      root.querySelectorAll('input[name="packs"]').forEach(input => input.checked = false);
    });
    root.querySelector('[data-mcc-action="scan"]')?.addEventListener("click", async event => {
      const selected = [...root.querySelectorAll('input[name="packs"]:checked')].map(input => input.value);
      if (!selected.length) return ui.notifications.warn("Select at least one Item compendium.");
      await scanPacks(selected, root.querySelector('[data-role="status"]'), event.currentTarget);
      await this.render({ force: true });
    });
  }
}

async function scanPacks(collections, status, button) {
  button.disabled = true;
  try {
    const pack = await getOrCreateComponentPack();
    if (pack.locked) await pack.configure({ locked: false });
    await ensurePouchItem(pack);

    const existing = await pack.getDocuments();
    const byKey = new Map(existing.map(item => [item.getFlag(MODULE_ID, "componentKey"), item]).filter(([key]) => key));
    const index = {};
    const review = [];
    let spellCount = 0;

    for (const collection of collections) {
      const sourcePack = game.packs.get(collection);
      if (!sourcePack) continue;
      status.textContent = `Scanning ${sourcePack.title}…`;
      const documents = await sourcePack.getDocuments();

      for (const spell of documents.filter(document => document.type === "spell")) {
        spellCount += 1;
        const material = readMaterial(spell);
        if (!material.required || !material.text) continue;

        const parsed = parseEnglishMaterial(material.text, material);
        if (!parsed.components.length) {
          review.push({ spell: spell.name, uuid: spell.uuid, material: material.text, reason: "Could not parse component" });
          continue;
        }

        const references = [];
        for (const component of parsed.components) {
          let item = byKey.get(component.key);
          if (!item) {
            [item] = await Item.implementation.createDocuments([componentItemData(component)], { pack: pack.collection });
            byKey.set(component.key, item);
          }
          references.push({
            key: component.key,
            uuid: item.uuid,
            name: item.name,
            minimumCost: component.minimumCost || 0,
            consumed: component.consumed,
            quantity: component.quantity || 1
          });
        }

        index[spell.uuid] = { spellName: spell.name, materialText: material.text, components: references };
      }
    }

    await game.settings.set(MODULE_ID, INDEX_SETTING, index);
    await game.settings.set(MODULE_ID, "manualReview", review);
    status.textContent = `Done: ${spellCount} spells scanned, ${Object.keys(index).length} indexed, ${byKey.size} component items, ${review.length} for manual review.`;
    ui.notifications.info("Material component scan completed.");
  } catch (error) {
    console.error(`${MODULE_ID} | Scan failed`, error);
    status.textContent = `Scan failed: ${error.message}`;
    ui.notifications.error(`Material component scan failed: ${error.message}`);
  } finally {
    button.disabled = false;
  }
}

async function getOrCreateComponentPack() {
  const current = game.packs.get(COMPONENT_PACK);
  if (current) return current;
  return foundry.documents.collections.CompendiumCollection.createCompendium({
    type: "Item",
    label: "Material Components",
    name: "material-components",
    package: "world"
  });
}

async function ensurePouchItem(pack) {
  const documents = await pack.getDocuments();
  const current = documents.find(item => item.getFlag(MODULE_ID, "pouchKey") === POUCH_KEY);
  if (current) return current;

  const [created] = await Item.implementation.createDocuments([{
    name: "Spell Component Pouch",
    type: "container",
    img: "icons/containers/bags/pouch-leather-brown.webp",
    system: {
      description: { value: "<p>A dedicated container for material spell components.</p>" },
      quantity: 1,
      weight: { value: 2, units: "lb" },
      price: { value: 25, denomination: "gp" },
      capacity: { type: "weight", value: 30 },
      currency: {},
      properties: []
    },
    flags: { [MODULE_ID]: { pouchKey: POUCH_KEY, componentPouchContainer: true } }
  }], { pack: pack.collection });
  return created;
}

function readMaterial(spell) {
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
  return { required: propertyRequired || components.m === true || components.material === true || Boolean(text), text, cost, consumed };
}

function parseEnglishMaterial(text, material) {
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

  const components = splitComponents(value).map((part, index) => {
    const name = canonicalName(part);
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

function splitComponents(value) {
  const descriptive = /\b(?:made of|piece of|bit of|sprig of|drop of|handful of|pinch of|from|inlaid with|filled with)\b/i.test(value);
  if (/\b(?:and|or)\b/i.test(value) && !descriptive) {
    return value.split(/\s*(?:,|;|\band\b|\bor\b)\s*/i).filter(Boolean);
  }
  return [value];
}

function canonicalName(value) {
  return value
    .replace(/^(?:a|an|the|some|a bit of|a piece of|a pinch of|a drop of|a sprig of|a handful of)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, character => character.toUpperCase());
}

function componentItemData(component) {
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

async function preUseActivity(activity) {
  try {
    if (game.user.isGM && game.settings.get(MODULE_ID, "gmBypass")) return true;
    const spell = activity?.item;
    if (!spell || spell.type !== "spell") return true;

    const material = readMaterial(spell);
    if (!material.required) return true;

    const actor = spell.actor ?? activity.actor;
    if (!actor) return false;
    const record = resolveSpellRecord(spell);
    if (!record?.components?.length) return block(`${spell.name} has no indexed material component. Run the scanner first.`);

    const mode = game.settings.get(MODULE_ID, "mode");
    const relevant = record.components.filter(component => mode !== "costly" || component.minimumCost > 0 || component.consumed);
    if (!relevant.length) return true;

    const missing = relevant.filter(requirement => !findInventoryComponent(actor, requirement));
    if (!missing.length) {
      PENDING_COMPONENTS.set(activity, relevant);
      return true;
    }

    if (mode === "raw" && relevant.every(component => !component.minimumCost && !component.consumed) && hasSpellcastingFocus(actor)) return true;
    return block(`${actor.name} cannot cast “${spell.name}”. Missing: ${missing.map(component => component.name).join(", ")}.`);
  } catch (error) {
    console.error(`${MODULE_ID} | Check failed`, error);
    return true;
  }
}

async function postUseActivity(activity) {
  if (!game.settings.get(MODULE_ID, "consumeComponents")) return;
  const actor = activity?.item?.actor ?? activity?.actor;
  const used = PENDING_COMPONENTS.get(activity)?.filter(component => component.consumed) ?? [];
  PENDING_COMPONENTS.delete(activity);

  for (const requirement of used) {
    const item = findInventoryComponent(actor, requirement);
    if (!item) continue;
    const quantity = Number(item.system.quantity ?? 1);
    await item.update({ "system.quantity": Math.max(0, quantity - (requirement.quantity || 1)) });
  }
}

function resolveSpellRecord(spell) {
  const index = game.settings.get(MODULE_ID, INDEX_SETTING) ?? {};
  if (index[spell.uuid]) return index[spell.uuid];
  const sourceId = spell.getFlag("core", "sourceId");
  if (sourceId && index[sourceId]) return index[sourceId];
  return Object.values(index).find(record => record.spellName === spell.name) ?? null;
}

function findInventoryComponent(actor, requirement) {
  const requiredName = normalize(requirement.name);
  const allowLoose = game.settings.get(MODULE_ID, "allowLooseComponents");
  const pouchIds = getComponentPouches(actor).map(pouch => pouch.id);

  return actor.items.find(item => {
    if (Number(item.system?.quantity ?? 1) < (requirement.quantity || 1)) return false;
    const key = item.getFlag(MODULE_ID, "componentKey");
    if (normalize(item.name) !== requiredName && key !== requirement.key) return false;
    if (!allowLoose && !pouchIds.includes(item.system?.container)) return false;
    return !requirement.minimumCost || itemValueInGp(item) >= requirement.minimumCost;
  });
}

function getComponentPouches(actor) {
  return actor.items.filter(item =>
    item.type === "container"
    && Number(item.system?.quantity ?? 1) > 0
    && (item.getFlag(MODULE_ID, "componentPouchContainer") || item.getFlag(MODULE_ID, "pouchKey") === POUCH_KEY)
  );
}

function itemValueInGp(item) {
  const price = item.system?.price ?? {};
  const value = Number(price.value ?? price) || 0;
  const denomination = price.denomination ?? "gp";
  return value * ({ cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 }[denomination] ?? 1);
}

function hasSpellcastingFocus(actor) {
  return actor.items.some(item => Number(item.system?.quantity ?? 1) > 0 && (
    /\b(?:arcane focus|druidic focus|holy symbol)\b/i.test(item.name)
    || item.getFlag(MODULE_ID, "focus")
  ));
}

function extractCost(text) {
  const match = text.match(/(?:worth|costing)\s+(?:at least\s+)?([\d,]+)\s*(cp|sp|ep|gp|pp)/i);
  if (!match) return 0;
  const value = Number(match[1].replace(/,/g, ""));
  return value * ({ cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 }[match[2].toLowerCase()] ?? 1);
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(?:a|an|the|some|of)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function block(message) {
  ui.notifications.error(message);
  return false;
}
