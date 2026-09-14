<script>
  import { VisibilityObserver } from '@sveltia/ui';

  import FieldEditor from '$lib/components/contents/details/editor/field-editor.svelte';
  import PathEditor from '$lib/components/contents/details/editor/path-editor.svelte';
  import SettingsGroup from '$lib/components/contents/details/editor/settings-group.svelte';
  import SlugEditor from '$lib/components/contents/details/editor/slug-editor.svelte';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';

  /**
   * @import { InternalLocaleCode } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {InternalLocaleCode} locale Current pane’s locale.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    /* eslint-enable prefer-const */
  } = $props();

  const fields = $derived(entryDraft.current?.fields ?? []);
  const showPathEditor = $derived(
    entryDraft.current?.currentPath !== undefined && !entryDraft.current?.isIndexFile,
  );

  const titleField = $derived(fields.find((f) => f.name === 'title'));
  const bodyField = $derived(
    fields.find((f) => f.name === 'body' || ['richtext', 'markdown'].includes(f.widget)),
  );
  const settingsFields = $derived(
    fields.filter((f) => f !== titleField && f !== bodyField),
  );
  const mainFields = $derived(
    fields.filter((f) => f === bodyField),
  );

  const settingsCount = $derived(
    settingsFields.length +
      (entryDraft.current?.slugEditor[locale] ? 1 : 0) +
      (showPathEditor ? 1 : 0),
  );

  const hasSettingsErrors = $derived(
    settingsFields.some((f) => {
      const v = entryDraft.current?.validities[locale]?.[f.name];
      return v && v.valid === false;
    }) ||
      entryDraft.current?.validities[locale]?._slug?.valid === false ||
      entryDraft.current?.validities[locale]?._path?.valid === false,
  );
</script>

<VisibilityObserver>
  {#if titleField}
    <VisibilityObserver>
      <FieldEditor
        keyPath={titleField.name}
        typedKeyPath={titleField.name}
        {locale}
        fieldConfig={titleField}
        compact={true}
      />
    </VisibilityObserver>
  {/if}

  {#if settingsCount > 0}
    <SettingsGroup count={settingsCount} hasErrors={hasSettingsErrors}>
      {#if !!entryDraft.current?.slugEditor[locale]}
        <SlugEditor {locale} />
      {/if}
      {#if showPathEditor}
        <PathEditor {locale} />
      {/if}
      {#each settingsFields as fieldConfig (fieldConfig.name)}
        <VisibilityObserver>
          <FieldEditor
            keyPath={fieldConfig.name}
            typedKeyPath={fieldConfig.name}
            {locale}
            {fieldConfig}
            compact={true}
          />
        </VisibilityObserver>
      {/each}
    </SettingsGroup>
  {/if}

  {#each mainFields as fieldConfig (fieldConfig.name)}
    <VisibilityObserver>
      <FieldEditor
        keyPath={fieldConfig.name}
        typedKeyPath={fieldConfig.name}
        {locale}
        {fieldConfig}
      />
    </VisibilityObserver>
  {/each}
</VisibilityObserver>

