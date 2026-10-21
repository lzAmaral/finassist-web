<script lang="ts">
  let { name, size = 20 }: { name: string; size?: number } = $props();
  const paths: Record<string, string> = {
    grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    arrows: 'M3 7h17m-5-5 5 5-5 5M21 17H4m5-5-5 5 5 5',
    wallet:
      'M20 8V5H4a2 2 0 0 1 0-4h14v4M4 5a2 2 0 0 0-2 2v13h19V8H4m17 5h-6v4h6',
    chart: 'M4 20V10m8 10V4m8 16v-7',
    target: 'M21 12a9 9 0 1 1-9-9m0 4a5 5 0 1 0 5 5M12 12l9-9m-5 0h5v5',
    bank: 'm3 8 9-5 9 5H3m2 3v7m7-7v7m7-7v7M3 21h18',
    chevron: 'm9 5 7 7-7 7',
    search: 'M21 21l-5-5m2-6a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
    download: 'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
    up: 'm7 14 10-10M7 4h10v10',
    down: 'm7 10 10 10M7 20h10V10',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12m13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2m3 6a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',
    check: 'm5 12 4 4L19 6',
    logout: 'M9 3H3v18h6m5-14 5 5-5 5m-7-5h12'
  };
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.65"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"><path d={paths[name] ?? paths.grid} /></svg
>
