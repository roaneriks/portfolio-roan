# Self-hosted fonts

Per the project brief, **Clash Display** and **General Sans** are self-hosted —
do not load the Fontshare API in production.

Download the `.woff2` files from Fontshare and drop them into this folder with
these exact filenames (referenced by `css/fonts.css`):

| File | Family | Weight |
|---|---|---|
| `ClashDisplay-Semibold.woff2` | Clash Display | 600 |
| `GeneralSans-Regular.woff2`   | General Sans  | 400 |
| `GeneralSans-Medium.woff2`    | General Sans  | 500 |

Sources:
- Clash Display — https://www.fontshare.com/fonts/clash-display
- General Sans — https://www.fontshare.com/fonts/general-sans

Until these files are present, the site falls back to the system font stack
defined in `css/tokens.css` and still renders correctly.

**Space Mono** is loaded from Google Fonts (a `<link>` in each page `<head>`),
so no file is needed for it.
