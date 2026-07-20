# Material Component Checker

Material Component Checker is an English-only module for Foundry Virtual Tabletop 13 and the D&D5e game system. It scans spell compendiums, extracts material component descriptions, creates inventory items for those components, creates a real spell component pouch container, and prevents a spell from being cast when its required material component is unavailable.

## Compatibility

- Foundry Virtual Tabletop 13
- D&D5e 4.0.0 or newer
- Verified with D&D5e 5.3.0
- English spell data only

The scanner is designed for English material-component wording. Translated spell compendiums are not supported.

## Main features

- Scans one or more Item compendiums selected by the GM.
- Reads spells that require material components.
- Extracts English material-component text.
- Creates a world compendium named **Material Components**.
- Creates reusable component items as D&D5e `loot` items.
- Creates a real D&D5e `container` item named **Spell Component Pouch**.
- Stores a world-level spell UUID to component index without modifying source compendiums.
- Checks an actor's inventory before a spell is used.
- Supports costly and consumed components.
- Supports automatic deduction of consumed components.
- Supports Arcane Focus, Druidic Focus, and Holy Symbol in Rules-as-Written mode.
- Supports multiple component pouches on one actor.
- Optionally accepts components stored outside a pouch.
- Optionally allows the GM to bypass all checks.

## Installation

1. Extract the `material-component-checker` folder from the ZIP archive.
2. Copy it into the Foundry user-data modules directory:

   ```text
   FoundryVTT/Data/modules/
   ```

3. Restart Foundry VTT.
4. Open the desired world.
5. Open **Manage Modules**.
6. Enable **Material Component Checker**.

## Initial setup

The module does not ship with a fixed component list. The GM must scan the English spell compendiums used by the world.

1. Open **Configure Settings**.
2. Open **Module Settings**.
3. Find **Material Component Scanner**.
4. Click **Scan spell compendiums**.
5. Select one or more Item compendiums containing English D&D5e spells.
6. Click **Scan selected compendiums**.
7. Wait for the completion message.

The scanner creates or updates the world compendium:

```text
Material Components
```

The compendium contains:

- generated material-component items;
- the **Spell Component Pouch** container.

The original spell compendiums are not edited.

## Adding a component pouch to a character

1. Open the **Material Components** compendium.
2. Drag **Spell Component Pouch** to the actor's inventory.
3. Drag required component items from the same compendium to the actor.
4. On the D&D5e actor sheet, move those component items into the pouch.

The pouch is a real D&D5e container. The module checks each component item's `system.container` value to determine whether it is stored inside a module-created pouch.

An actor may carry more than one **Spell Component Pouch**. Components stored in any valid pouch are accepted.

The pouch itself does not provide unlimited components. It is only a container. Required costly or consumed components must exist as actual inventory items.

## Casting workflow

When a spell is used, the module:

1. Detects the spell before its activity is executed.
2. Looks up the spell in the scanner-generated index.
3. Determines which material components must be checked under the selected checking mode.
4. Searches the casting actor's inventory.
5. Verifies quantity, location, and minimum value.
6. Blocks the cast when a required component is missing.
7. Displays an error notification listing the missing components.
8. After a successful cast, optionally reduces the quantity of consumed components.

A blocked cast is cancelled before normal spell use proceeds.

## Module settings

All settings are world settings and are controlled by the GM.

### Checking mode

Controls which material components are required.

#### Rules as written

This is the default mode.

- Costly components must exist as inventory items.
- Consumed components must exist as inventory items.
- Free, non-consumed components may be replaced by an Arcane Focus, Druidic Focus, or Holy Symbol.
- A focus does not replace a component with a listed cost.
- A focus does not replace a component consumed by the spell.

The module recognizes focuses by an English inventory-item name containing:

- `Arcane Focus`
- `Druidic Focus`
- `Holy Symbol`

A custom item can also be recognized by setting the module flag `focus` to `true`.

#### Always require the actual item

Every indexed material component must exist as a matching inventory item.

A spellcasting focus does not replace free components in this mode.

#### Check only costly or consumed components

The module ignores free, non-consumed components.

It checks only components that:

- have a minimum monetary value; or
- are consumed by the spell.

This is the least intrusive mode for campaigns that only track important components.

### Allow GM bypass

Default: disabled.

When enabled, spell casts initiated by a GM are never blocked by the module. Player casts are still checked normally.

### Allow loose material components

Default: disabled.

When disabled, matching component items must be stored inside a valid **Spell Component Pouch**.

When enabled, the module also accepts matching component items located elsewhere in the actor's inventory.

This option does not make the pouch itself supply components. It only changes whether loose inventory items are accepted.

### Consume components automatically

Default: enabled.

When enabled, a consumed component's inventory quantity is reduced after a successful spell use.

For example, if the actor has two matching diamonds and the spell consumes one, the quantity becomes one.

When the resulting quantity reaches zero, the item remains in the inventory with quantity `0`; it is not automatically deleted.

### Material Component Scanner

Opens the scanner window used to:

- select Item compendiums;
- scan English spells;
- create or update component items;
- create the Spell Component Pouch;
- rebuild the spell-component index.

Run the scanner again after adding or updating spell compendiums.

## Component matching

Generated component items contain a module-specific component key. During a cast, the module first uses that key and also supports normalized exact English-name matching.

Matching ignores:

- capitalization;
- punctuation;
- repeated whitespace;
- basic English articles such as `a`, `an`, `the`, and `some`.

For the most reliable results, use the generated items from the **Material Components** compendium instead of manually creating similarly named items.

## Cost checks

For a costly component, the module compares the spell's minimum required value against the D&D5e price stored on the inventory item.

Supported denominations:

- cp
- sp
- ep
- gp
- pp

All prices are converted to a gold-piece equivalent for comparison.

Example:

```text
A diamond worth at least 300 gp
```

A diamond item worth 300 gp or more is accepted. A diamond worth 250 gp is rejected.

## Consumed components

The scanner attempts to detect wording such as:

```text
which the spell consumes
```

When automatic consumption is enabled, the matching item's quantity is reduced after successful use.

The item consumed is the actual matching inventory item, including an item stored inside a component pouch.

## Spell index behavior

The scanner stores a world-level mapping from spell UUIDs to generated component records.

Source compendiums remain unchanged, including locked system and module compendiums.

For a spell imported to an actor, the module resolves the index in this order:

1. the spell's own UUID;
2. its `core.sourceId` flag;
3. an exact English spell-name fallback.

If a spell requiring materials has no index entry, the cast is blocked and the user is instructed to run the scanner.

## Re-scanning

Re-run the scanner when:

- a new spell compendium is installed;
- a spell compendium is updated;
- new homebrew spells are added to a compendium;
- component parsing rules change after a module update;
- the Material Components compendium or spell index needs rebuilding.

Existing generated component items are reused when their component key matches. Source spell compendiums are never modified.

## English parser behavior

Material descriptions are natural language, so extraction cannot be perfect for every third-party source.

The parser currently attempts to:

- remove cost wording from component names;
- detect minimum monetary value;
- detect whether a component is consumed;
- split simple lists joined by `and`, `or`, commas, or semicolons;
- preserve descriptive phrases such as `a piece of`, `a drop of`, or `a sprig of` as one component where possible;
- normalize generated component names to English title case.

Examples:

```text
A tiny ball of bat guano and sulfur
```

may produce separate generated items for bat guano and sulfur.

```text
A diamond worth at least 300 gp, which the spell consumes
```

produces a diamond component with a 300 gp minimum and the consumed flag.

## Limitations

- Only English spell-component wording is supported.
- Unusual third-party wording may be parsed incorrectly.
- Complex alternatives in one material description may require manual correction.
- The scanner does not modify source spells to embed component UUIDs.
- Imported spells with no source UUID rely on an exact English-name fallback.
- The current parser generally assigns a detected monetary cost to the first parsed component in a list.
- Automatic consumption changes quantity but does not delete zero-quantity items.
- A component item must use the D&D5e price field for minimum-value checks.
- A custom container is not automatically accepted as a pouch unless it carries the module's pouch flag.

## Troubleshooting

### A spell is blocked with "no indexed material component"

Run **Material Component Scanner** and ensure the compendium containing that English spell was selected.

### A component exists but is reported missing

Check that:

- the item quantity is at least 1;
- the generated component item was used;
- the item is inside **Spell Component Pouch** when loose components are disabled;
- the item's value meets the spell's minimum cost;
- the scanner was run after the spell compendium was installed or updated.

### A focus does not replace the component

Confirm that:

- **Checking mode** is set to **Rules as written**;
- the component has no monetary cost;
- the component is not consumed;
- the focus item name contains `Arcane Focus`, `Druidic Focus`, or `Holy Symbol`.

### Components outside the pouch are ignored

Enable **Allow loose material components** in Module Settings, or move the component items into a module-created **Spell Component Pouch**.

### Consumed components are not deducted

Confirm that **Consume components automatically** is enabled and the spell's English material wording clearly indicates that the component is consumed.

## Uninstallation

1. Disable the module in **Manage Modules**.
2. Delete the `material-component-checker` folder from the Foundry modules directory.

The world compendium **Material Components** and world settings may remain in the world after the module is removed. Delete the compendium manually only if its generated items are no longer needed.
