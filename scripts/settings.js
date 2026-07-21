import { INDEX_SETTING, MODULE_ID, REVIEW_SETTING } from "./constants.js";
import { MaterialScannerApp } from "./scanner-app.js";

export function registerSettings() {
  game.settings.register(MODULE_ID, INDEX_SETTING, {
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register(MODULE_ID, REVIEW_SETTING, {
    scope: "world",
    config: false,
    type: Array,
    default: []
  });

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
}
