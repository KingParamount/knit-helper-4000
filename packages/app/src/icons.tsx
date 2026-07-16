/* Simple line icons for the buttons. Stroke uses currentColor so they follow the
 * button's text colour (dark normally, white when selected). Fill-none throughout. */
import type { JSX } from 'react';

const svg = (children: JSX.Element): JSX.Element => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

export const IconSweater = (): JSX.Element =>
  svg(<><path d="M11 5 6 9l2 3 2-1v15h12V11l2 1 2-3-5-4-2 3h-6z" /></>);

export const IconCardigan = (): JSX.Element =>
  svg(<><path d="M11 5 6 9l2 3 2-1v15h12V11l2 1 2-3-5-4-2 3h-6z" /><path d="M16 7v19" /></>);

export const IconSkirt = (): JSX.Element =>
  svg(<><path d="M11 7h10l4 19H7z" /><path d="M11 7c0 3 10 3 10 0" /></>);

export const IconDog = (): JSX.Element =>
  svg(<><path d="M6 14c0-3 3-4 5-4h9l3 3v3h-2v8h-4v-6H11v6H7v-8c-1 0-1-2-1-2z" /><path d="M20 10V6l3 2" /></>);

export const IconBaby = (): JSX.Element =>
  svg(<><circle cx="16" cy="10" r="4" /><path d="M10 27v-4a6 6 0 0 1 12 0v4" /></>);
export const IconChild = (): JSX.Element =>
  svg(<><circle cx="16" cy="9" r="4" /><path d="M9 27v-6a7 7 0 0 1 14 0v6" /></>);
export const IconWoman = (): JSX.Element =>
  svg(<><circle cx="16" cy="8" r="4" /><path d="M11 13h10l-2 6 2 8h-10l2-8z" /></>);
export const IconMan = (): JSX.Element =>
  svg(<><circle cx="16" cy="8" r="4" /><path d="M8 26v-9a8 8 0 0 1 16 0v9" /></>);
export const IconCustom = (): JSX.Element =>
  svg(<><path d="M5 20 20 5l7 7L12 27H5z" /><path d="M15 10l7 7" /></>);

export const IconEase = (): JSX.Element =>
  svg(<><path d="M13 6h6v3l2 1v16h-10V10l2-1z" /><path d="M11 12v11M21 12v11" strokeDasharray="2 2" /></>);

export const IconCrew = (): JSX.Element =>
  svg(<><path d="M6 8h20" /><path d="M11 8a5 5 0 0 0 10 0" /><path d="M6 8v18h20V8" /></>);
export const IconVneck = (): JSX.Element =>
  svg(<><path d="M6 8h20" /><path d="M10 8l6 8 6-8" /><path d="M6 8v18h20V8" /></>);

export const IconDocFull = (): JSX.Element =>
  svg(<><rect x="8" y="4" width="16" height="24" rx="2" /><path d="M11 10h10M11 14h10M11 18h10M11 22h6" /></>);
export const IconDocShort = (): JSX.Element =>
  svg(<><rect x="8" y="4" width="16" height="24" rx="2" /><path d="M11 11h10M11 16h7M11 21h9" /></>);
export const IconChart = (): JSX.Element =>
  svg(<><rect x="6" y="6" width="20" height="20" rx="1" /><path d="M11 6v20M16 6v20M21 6v20M6 11h20M6 16h20M6 21h20" strokeWidth={1} /></>);
export const IconRoller = (): JSX.Element =>
  svg(<><rect x="6" y="7" width="20" height="6" rx="3" /><path d="M16 13v5" /><rect x="11" y="18" width="10" height="8" rx="1" /></>);

export const IconPrint = (): JSX.Element =>
  svg(<><path d="M9 12V5h14v7" /><rect x="6" y="12" width="20" height="9" rx="2" /><path d="M9 21v6h14v-6" /></>);
