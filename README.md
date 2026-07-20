# Material Component Checker

Material Component Checker is an English-only module for Foundry Virtual Tabletop and the D&D5e game system. It scans spell compendiums, creates reusable material-component items, adds a real **Spell Component Pouch** container, checks an actor's inventory before casting, and optionally consumes components after a successful cast.

## Compatibility

Version 2.2.0 targets:

- Foundry Virtual Tabletop **14.365**
- D&D5e system **5.3.3**
- English spell data only

The scanner uses Foundry's `ApplicationV2` API. Spell validation uses `dnd5e.preUseActivity`, and automatic consumption uses `dnd5e.postUseActivity`.

## Features

- Scans selected Item compendiums for D&D5e spells.
- Extracts English material-component descriptions.
- Creates a world compendium named **Material Components**.
- Creates material components as reusable D&D5e `loot` items.
- Creates **Spell Component Pouch** as a real D&D5e `container` item.
- Keeps source spell compendiums unchanged.
- Stores a world-level `Spell UUID → components` index.
- Blocks casting when required components are missing.
- Checks component quantity and minimum monetary value.
- Supports consumed components and automatic quantity reduction.
- Supports Arcane Focus, Druidic Focus, and Holy Symbol in Rules-as-Written mode.
- Supports multiple component pouches on one actor.
- Optionally accepts loose components outside a pouch.
- Optionally allows GM bypass.

## Installation

1. Download or clone this repository.
2. Place the repository folder in:

   ```text
   FoundryVTT/Data/modules/material-component-checker
   ```

3. Restart Foundry VTT.
4. Open the world and enable **Material Component Checker** under **Manage Modules**.

## Initial setup

1. Open **Configure Settings → Module Settings**.
2. Find **Material Component Scanner**.
3. Click **Scan spell compendiums**.
4. Select one or more English Item compendiums containing D&D5e spells.
5. Click **Scan selected compendiums**.

The module creates or updates the world compendium **Material Components**. It contains all generated component items and the **Spell Component Pouch**.

Run the scanner again whenever spell compendiums are added or updated.

## Spell Component Pouch

1. Open the **Material Components** compendium.
2. Drag **Spell Component Pouch** to the character's inventory.
3. Drag required material-component items to the character.
4. Move those component items inside the pouch on the D&D5e actor sheet.

The pouch is a real container. It does not supply unlimited components by itself. Costly and consumed components must exist as actual items.

By default, generated components must be stored inside a valid module-created pouch. Enable **Allow loose material components** to accept matching items elsewhere in the inventory.

## Settings

### Checking mode

**Rules as written**

- Costly and consumed components must be present.
- Free, non-consumed components may be replaced by an Arcane Focus, Druidic Focus, or Holy Symbol.

**Always require the actual item**

- Every indexed material component must exist as an inventory item.
- A focus does not replace free components.

**Check only costly or consumed components**

- Free, non-consumed components are ignored.
- Only important components are tracked.

### Allow GM bypass

When enabled, casts initiated by a GM are not blocked.

### Allow loose material components

When disabled, components must be stored inside **Spell Component Pouch**. When enabled, matching loose inventory items are also accepted.

### Consume components automatically

When enabled, the quantity of a consumed component is reduced after a successful spell use. Items that reach quantity `0` remain in the inventory.

## Component matching

Generated items contain a module-specific component key. Matching also supports normalized exact English names and ignores capitalization, punctuation, repeated whitespace, and basic English articles.

For reliable matching, use the generated items from the **Material Components** compendium.

## Cost checks

Supported denominations:

- cp
- sp
- ep
- gp
- pp

Prices are converted to a gold-piece equivalent. For example, a spell requiring a diamond worth at least 300 gp accepts a diamond item worth 300 gp or more.

## Scanner limitations

Material descriptions are natural language, so unusual third-party wording may require manual review. The parser is designed for English data and may not correctly handle translations, complex alternatives, or highly customized spell structures.

If a spell requiring materials has no index entry, the cast is blocked and the user is instructed to run the scanner.

## Troubleshooting

**The spell says it has no indexed component**

Run the scanner and select the compendium containing that spell.

**A component exists but is reported missing**

Check that:

- quantity is at least 1;
- the generated component item is being used;
- the item is inside the pouch when loose components are disabled;
- its value meets the minimum cost;
- the scanner was run after the compendium was installed or updated.

**A focus does not replace the component**

Confirm that Rules-as-Written mode is selected and that the component is neither costly nor consumed.

**Consumed components are not deducted**

Confirm that automatic consumption is enabled and the English material wording clearly indicates consumption.

## Version

Current module version: **2.2.0**
