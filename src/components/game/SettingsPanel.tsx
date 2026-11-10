import { useEffect, useRef } from 'preact/hooks';
import type { Settings } from '@/engines/core/storage';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
}

export function SettingsPanel({ settings, onChange, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    d?.addEventListener('cancel', onCancel);
    return () => d?.removeEventListener('cancel', onCancel);
  }, [onClose]);

  const toggle = (key: keyof Settings) => (e: Event) => {
    const checked = (e.currentTarget as HTMLInputElement).checked;
    onChange({ ...settings, [key]: checked });
  };

  const row = 'flex min-h-11 items-center justify-between gap-4 py-1';

  return (
    <dialog ref={ref} class="m-auto w-[min(92vw,28rem)] rounded-xl border border-border bg-bg-elev p-0 text-fg shadow-2xl backdrop:bg-black/50">
      <form method="dialog" class="p-5" onSubmit={onClose}>
        <h2 class="text-lg font-bold">Settings</h2>
        <p class="mt-1 text-sm text-muted">Saved on this device. No account needed.</p>

        <fieldset class="mt-4">
          <legend class="text-sm font-semibold">Display</legend>
          <label class={row}>
            <span>Theme</span>
            <select
              class="min-h-11 rounded-md border border-border bg-bg px-2"
              value={settings.theme}
              onChange={(e) => onChange({ ...settings, theme: (e.currentTarget as HTMLSelectElement).value as Settings['theme'] })}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label class={row}>
            <span>High contrast</span>
            <input type="checkbox" class="size-6" checked={settings.highContrast} onChange={toggle('highContrast')} />
          </label>
          <label class={row}>
            <span>Large tiles (board may scroll)</span>
            <input type="checkbox" class="size-6" checked={settings.largeTiles} onChange={toggle('largeTiles')} />
          </label>
          <label class={row}>
            <span>Dim blocked tiles</span>
            <input type="checkbox" class="size-6" checked={settings.highlightFree} onChange={toggle('highlightFree')} />
          </label>
          <label class={row}>
            <span>Reduce motion</span>
            <input type="checkbox" class="size-6" checked={settings.reducedMotion} onChange={toggle('reducedMotion')} />
          </label>
        </fieldset>

        <div class="mt-5 flex justify-end">
          <button class="min-h-11 rounded-md bg-accent px-4 font-medium text-accent-fg" type="submit">
            Done
          </button>
        </div>
      </form>
    </dialog>
  );
}
