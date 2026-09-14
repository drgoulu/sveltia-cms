<script>
  import { _ } from '@sveltia/i18n';
  import { setContext } from 'svelte';

  import ExpandIcon from '$lib/components/common/expand-icon.svelte';

  /**
   * @import { Snippet } from 'svelte';
   */

  /**
   * @typedef {object} Props
   * @property {number} [count] Number of settings fields.
   * @property {boolean} [hasErrors] Whether any field inside has validation errors.
   * @property {Snippet} [children] Slot content.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    count = 0,
    hasErrors = false,
    children = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const STORAGE_KEY = 'sveltia-cms.entry-editor.settings-expanded';

  // Inform all child FieldEditorGroup components that they should be compact
  setContext('compact-fields', true);

  const initialExpanded = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored !== null ? stored === 'true' : false;
    } catch {
      return false;
    }
  };

  let userExpanded = $state(initialExpanded());

  // Automatically expand if there are validation errors
  const isExpanded = $derived(hasErrors || userExpanded);

  const toggle = () => {
    userExpanded = !isExpanded;
    try {
      localStorage.setItem(STORAGE_KEY, String(userExpanded));
    } catch {
      // Ignore localStorage error
    }
  };
</script>

<div class="settings-group" class:expanded={isExpanded} class:has-errors={hasErrors}>
  <button
    type="button"
    class="settings-header-btn"
    aria-expanded={isExpanded}
    aria-controls="settings-group-content"
    onclick={toggle}
  >
    <span class="icon-wrap">
      <ExpandIcon expanded={isExpanded} />
    </span>
    <span class="title">{_('settings')}</span>
    {#if count > 0}
      <span class="badge">{count}</span>
    {/if}
  </button>
  <div
    id="settings-group-content"
    class="settings-content"
    class:collapsed={!isExpanded}
    role="region"
    aria-label={_('settings')}
  >
    {@render children?.()}
  </div>
</div>

<style>
  .settings-group {
    margin-inline: auto;
    max-width: 768px;
    border: 1px solid var(--sui-secondary-border-color);
    border-radius: var(--sui-corner-radius);
    background-color: var(--sui-secondary-background-color);
    margin-block: 6px 12px;
    transition: border-color var(--sui-transition-duration) ease;

    &:hover {
      border-color: var(--sui-primary-border-color);
    }

    &.has-errors {
      border-color: var(--sui-error-border-color, #e53e3e);
    }
  }

  .settings-header-btn {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 6px 12px;
    gap: 8px;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    color: var(--sui-primary-foreground-color);
    font-size: var(--sui-font-size-small);
    font-weight: var(--sui-font-weight-bold);
    user-select: none;
    border-radius: var(--sui-corner-radius);

    &:hover {
      background-color: var(--sui-hover-background-color);
    }

    &:focus-visible {
      outline: var(--sui-focus-ring-width) solid var(--sui-focus-ring-color);
      outline-offset: -2px;
    }
  }

  .icon-wrap {
    display: flex;
    align-items: center;
    color: var(--sui-secondary-foreground-color);
  }

  .title {
    flex: 1;
    font-size: var(--sui-font-size-small);
    color: var(--sui-secondary-foreground-color);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .badge {
    font-size: var(--sui-font-size-x-small);
    font-weight: var(--sui-font-weight-normal);
    color: var(--sui-secondary-foreground-color);
    background-color: var(--sui-tertiary-background-color);
    padding: 1px 7px;
    border-radius: 10px;
  }

  .settings-content {
    border-top: 1px solid var(--sui-secondary-border-color);
    background-color: var(--sui-primary-background-color);

    &.collapsed {
      display: none;
    }

    :global {
      /* Remove inner border on last field within the settings group */
      & > *:last-child section::after,
      & > section:last-child::after {
        display: none;
      }
    }
  }
</style>
