import { MODULE_ID } from "./constants.js";
import { registerActivityHooks } from "./component-checker.js";
import { registerSettings } from "./settings.js";

Hooks.once("init", () => {
  registerSettings();
});

Hooks.once("ready", () => {
  if (game.system.id !== "dnd5e") {
    ui.notifications.warn("Material Component Checker supports only D&D5e.");
    return;
  }

  registerActivityHooks();
  console.log(`${MODULE_ID} | Ready for Foundry VTT 14`);
});
