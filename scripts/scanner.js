import { COMPONENT_PACK, INDEX_SETTING, MODULE_ID, POUCH_KEY, REVIEW_SETTING } from "./constants.js";
import { componentItemData, parseEnglishMaterial, readMaterial } from "./utils.js";

const POUCH_ICON = `modules/${MODULE_ID}/assets/spell-component-pouch.svg`;

export async function scanPacks(collections, onProgress = () => {}) {
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
    onProgress(`Scanning ${sourcePack.title}…`);
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
  await game.settings.set(MODULE_ID, REVIEW_SETTING, review);

  return {
    spellCount,
    indexedCount: Object.keys(index).length,
    componentCount: byKey.size,
    reviewCount: review.length
  };
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

  if (current) {
    const updates = {};
    if (current.img !== POUCH_ICON) updates.img = POUCH_ICON;
    if (!current.getFlag(MODULE_ID, "componentPouchContainer")) {
      updates[`flags.${MODULE_ID}.componentPouchContainer`] = true;
    }
    if (Object.keys(updates).length) await current.update(updates);
    return current;
  }

  const [created] = await Item.implementation.createDocuments([{
    name: "Spell Component Pouch",
    type: "container",
    img: POUCH_ICON,
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
