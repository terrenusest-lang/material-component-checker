import { INDEX_SETTING, MODULE_ID } from "./constants.js";
import { scanPacks } from "./scanner.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class MaterialScannerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "mcc-scanner",
    classes: ["material-component-checker", "mcc-scanner"],
    window: {
      title: "Material Component Scanner",
      icon: "fas fa-flask",
      resizable: true
    },
    position: { width: 640, height: "auto" }
  };

  static PARTS = {
    form: {
      template: "modules/material-component-checker/templates/scanner.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const packs = game.packs
      .filter(pack => pack.documentName === "Item")
      .map(pack => ({
        id: pack.collection,
        title: pack.title,
        package: pack.metadata.packageName ?? pack.metadata.package ?? "world"
      }))
      .sort((a, b) => a.title.localeCompare(b.title));

    return {
      ...context,
      packs,
      indexedCount: Object.keys(game.settings.get(MODULE_ID, INDEX_SETTING) ?? {}).length
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;

    root.querySelector('[data-action="select-all"]')?.addEventListener("click", () => {
      root.querySelectorAll('input[name="packs"]').forEach(input => { input.checked = true; });
    });

    root.querySelector('[data-action="clear-all"]')?.addEventListener("click", () => {
      root.querySelectorAll('input[name="packs"]').forEach(input => { input.checked = false; });
    });

    root.querySelector('[data-action="scan"]')?.addEventListener("click", async event => {
      const selected = [...root.querySelectorAll('input[name="packs"]:checked')].map(input => input.value);
      if (!selected.length) {
        ui.notifications.warn("Select at least one Item compendium.");
        return;
      }

      const button = event.currentTarget;
      const status = root.querySelector('[data-role="status"]');
      button.disabled = true;

      try {
        const result = await scanPacks(selected, message => { status.textContent = message; });
        status.textContent = `Done: ${result.spellCount} spells scanned, ${result.indexedCount} indexed, ${result.componentCount} component items, ${result.reviewCount} for manual review.`;
        ui.notifications.info("Material component scan completed.");
      } catch (error) {
        console.error(`${MODULE_ID} | Scan failed`, error);
        status.textContent = `Scan failed: ${error.message}`;
        ui.notifications.error(`Material component scan failed: ${error.message}`);
      } finally {
        button.disabled = false;
      }
    });
  }
}
