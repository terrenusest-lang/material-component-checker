import { INDEX_SETTING, MODULE_ID, POUCH_KEY } from "./constants.js";
import { itemValueInGp, normalize, readMaterial } from "./utils.js";

const pendingComponents = new Map();

export function registerActivityHooks() {
  Hooks.on("dnd5e.preUseActivity", preUseActivity);
  Hooks.on("dnd5e.postUseActivity", postUseActivity);
}

function getActivityKey(activity) {
  return activity?.uuid ?? `${activity?.item?.uuid ?? "unknown"}:${activity?.id ?? "unknown"}`;
}

function getOriginalSpell(activity) {
  const actor = activity?.actor ?? activity?.item?.actor;
  const itemId = activity?.item?.id;
  return actor?.items?.get(itemId) ?? activity?.item ?? null;
}

/**
 * This hook MUST stay synchronous. D&D5e calls Hooks.call(), not Hooks.callAll()
 * with awaiting, and only an immediate false return cancels activity.use().
 */
function preUseActivity(activity) {
  try {
    if (game.user.isGM && game.settings.get(MODULE_ID, "gmBypass")) return true;

    const spell = getOriginalSpell(activity);
    if (!spell || spell.type !== "spell") return true;

    const material = readMaterial(spell);
    if (!material.required) return true;

    const actor = spell.actor ?? activity?.actor;
    if (!actor) return block("The casting actor could not be resolved.");

    const record = resolveSpellRecord(spell);
    if (!record?.components?.length) {
      return block(`${spell.name} has no indexed material component. Run the scanner first.`);
    }

    const mode = game.settings.get(MODULE_ID, "mode");
    const relevant = record.components.filter(component =>
      mode !== "costly" || component.minimumCost > 0 || component.consumed
    );
    if (!relevant.length) return true;

    const missing = relevant.filter(requirement => !findInventoryComponent(actor, requirement));
    if (!missing.length) {
      pendingComponents.set(getActivityKey(activity), { actorUuid: actor.uuid, components: relevant });
      return true;
    }

    if (mode === "raw") {
      const substitutable = missing.filter(component => !component.minimumCost && !component.consumed);
      const mandatoryItems = missing.filter(component => component.minimumCost || component.consumed);

      if (!mandatoryItems.length && substitutable.length) {
        if (hasSpellcastingFocus(actor)) return true;
        return block(
          `${actor.name} cannot cast “${spell.name}”. Missing material components and no spellcasting focus is present.`
        );
      }

      if (mandatoryItems.length) {
        return block(
          `${actor.name} cannot cast “${spell.name}”. Missing required component items: ${mandatoryItems.map(component => component.name).join(", ")}. A focus cannot replace costly or consumed components.`
        );
      }
    }

    return block(`${actor.name} cannot cast “${spell.name}”. Missing: ${missing.map(component => component.name).join(", ")}.`);
  } catch (error) {
    console.error(`${MODULE_ID} | Component check failed`, error);
    return block(`Material component validation failed: ${error.message}`);
  }
}

async function postUseActivity(activity) {
  if (!game.settings.get(MODULE_ID, "consumeComponents")) return;

  const key = getActivityKey(activity);
  const pending = pendingComponents.get(key);
  pendingComponents.delete(key);
  if (!pending) return;

  const actor = await fromUuid(pending.actorUuid);
  if (!actor) return;

  for (const requirement of pending.components.filter(component => component.consumed)) {
    const item = findInventoryComponent(actor, requirement);
    if (!item) continue;

    const quantity = Number(item.system.quantity ?? 1);
    await item.update({
      "system.quantity": Math.max(0, quantity - (requirement.quantity || 1))
    });
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
  if (!actor) return null;

  const requiredName = normalize(requirement.name);
  const allowLoose = game.settings.get(MODULE_ID, "allowLooseComponents");
  const pouchIds = new Set(getComponentPouches(actor).map(pouch => pouch.id));

  return actor.items.find(item => {
    if (Number(item.system?.quantity ?? 1) < (requirement.quantity || 1)) return false;

    const key = item.getFlag(MODULE_ID, "componentKey");
    if (normalize(item.name) !== requiredName && key !== requirement.key) return false;

    const containerId = item.system?.container?.id ?? item.system?.container ?? null;
    if (!allowLoose && !pouchIds.has(containerId)) return false;

    return !requirement.minimumCost || itemValueInGp(item) >= requirement.minimumCost;
  });
}

function getComponentPouches(actor) {
  return actor.items.filter(item =>
    item.type === "container"
    && Number(item.system?.quantity ?? 1) > 0
    && (
      item.getFlag(MODULE_ID, "componentPouchContainer")
      || item.getFlag(MODULE_ID, "pouchKey") === POUCH_KEY
    )
  );
}

function hasSpellcastingFocus(actor) {
  return actor.items.some(item => {
    if (Number(item.system?.quantity ?? 1) <= 0) return false;

    if (item.getFlag(MODULE_ID, "focus")) return true;
    if (item.system?.focus === true) return true;

    const typeValue = String(item.system?.type?.value ?? item.system?.type ?? "").toLowerCase();
    if (["focus", "arcane", "druidic", "holy"].includes(typeValue)) return true;

    const properties = item.system?.properties;
    if (properties instanceof Set && properties.has("focus")) return true;
    if (Array.isArray(properties) && properties.includes("focus")) return true;

    return /\b(?:arcane focus|druidic focus|holy symbol|spellcasting focus)\b/i.test(item.name);
  });
}

function block(message) {
  ui.notifications.error(message, { permanent: false });
  return false;
}
