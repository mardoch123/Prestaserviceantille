import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type HtmlPdfOptions = {
  html: string;
  filename: string;
  title?: string;
  extraCss?: string;
  zoom?: number;
  signatureImages?: {
    client?: string | null;
    company?: string | null;
    companyStamp?: string | null;
  };
  signatureDates?: {
    client?: string | null;
    company?: string | null;
  };
  imageReplacements?: Record<string, string>;
};

const buildContractPdfCss = () => `
@page { size: A4; margin: 0; }
html, body { background: #fff; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
* { box-sizing: border-box; }

body, .pdf-root {
  font-kerning: normal;
  text-rendering: geometricPrecision;
  -webkit-font-smoothing: antialiased;
  letter-spacing: 0.1px;
  word-spacing: 0.2px;
}

.pdf-zoom {
  transform-origin: top left;
}

.pdf-root {
  width: 100%;
  background: #fff;
}

.pdf-root img { max-width: 100%; }

.pdf-root .page {
  width: 210mm;
  min-height: 297mm;
  background: #fff;
}

.pdf-root .page + .page { page-break-before: always; }

@media print {
  html, body { width: 210mm; }
}
`;

const extractBodyHtml = (html: string) => {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch && bodyMatch[1]) return bodyMatch[1];
  return html;
};

const extractBodyStyleAttr = (html: string) => {
  const bodyOpenTag = html.match(/<body\b([^>]*)>/i);
  if (!bodyOpenTag || !bodyOpenTag[1]) return '';
  const attrs = bodyOpenTag[1];
  const styleMatch = attrs.match(/style\s*=\s*(["'])([\s\S]*?)\1/i);
  return styleMatch && styleMatch[2] ? styleMatch[2] : '';
};

const extractHeadStyleTags = (html: string) => {
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (!headMatch || !headMatch[1]) return '';
  const head = headMatch[1];
  const styles = head.match(/<style[^>]*>[\s\S]*?<\/style>/gi);
  return styles ? styles.join('\n') : '';
};

const waitForImages = async (doc: Document) => {
  const images = Array.from(doc.images || []);
  if (images.length === 0) return;
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve();
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  );
};

const normalizeUrl = (raw: string) => {
  try {
    return new URL(raw, window.location.origin).toString();
  } catch {
    return raw;
  }
};

const injectLogoIfMissing = (doc: Document, imageReplacements?: Record<string, string>) => {
  if (!imageReplacements) return;
  const root = doc.querySelector('.pdf-root') as HTMLElement | null;
  if (!root) return;

  const hasLogo = Array.from(root.querySelectorAll('img')).some((img) => {
    const src = String(img.getAttribute('src') || '').toLowerCase();
    const alt = String(img.getAttribute('alt') || '').toLowerCase();
    return src.includes('logo') || alt.includes('logo');
  });
  if (hasLogo) return;

  const entry = Object.entries(imageReplacements).find(
    ([k, v]) => /logo/i.test(String(k || '')) && typeof v === 'string' && v.startsWith('data:image/')
  );
  if (!entry) return;
  const [, logoData] = entry;

  const wrapper = doc.createElement('div');
  wrapper.style.display = 'flex';
  wrapper.style.justifyContent = 'center';
  wrapper.style.alignItems = 'center';
  wrapper.style.margin = '12px 0 14px';

  const img = doc.createElement('img');
  img.src = String(logoData);
  img.alt = 'Logo';
  img.style.maxHeight = '85px';
  img.style.maxWidth = '230px';
  img.style.display = 'block';
  img.style.objectFit = 'contain';

  wrapper.appendChild(img);
  root.insertBefore(wrapper, root.firstChild);
};

const injectSignatureSectionIfMissing = (
  doc: Document,
  signatureImages?: HtmlPdfOptions['signatureImages'],
  signatureDates?: HtmlPdfOptions['signatureDates']
) => {
  if (!signatureImages) return;
  const root = (doc.querySelector('.pdf-root') as HTMLElement | null) || doc.body;
  const hasSignatureBoxes = !!root.querySelector('.signature-box');
  if (hasSignatureBoxes) return;

  const clientSrc = signatureImages.client || '';
  const companySrc = signatureImages.companyStamp || signatureImages.company || '';
  const clientDate = String(signatureDates?.client || '').trim();
  const companyDate = String(signatureDates?.company || '').trim();

  const section = doc.createElement('div');
  section.className = 'signature';
  section.style.marginTop = '24px';
  section.style.borderTop = '1px solid #ccc';
  section.style.paddingTop = '12px';
  section.style.display = 'flex';
  section.style.justifyContent = 'space-between';
  section.style.gap = '10px';

  const makeBox = (title: string, src: string, date: string) => {
    const box = doc.createElement('div');
    box.className = 'signature-box';
    box.style.width = '48%';
    box.style.textAlign = 'center';
    box.style.border = '1px solid #ccc';
    box.style.padding = '12px';
    box.style.minHeight = '100px';
    box.style.background = 'white';
    (box.style as any).pageBreakInside = 'avoid';

    const h = doc.createElement('h3');
    h.textContent = title;
    h.style.margin = '0 0 10px';
    h.style.fontSize = '13px';
    box.appendChild(h);

    if (src) {
      const img = doc.createElement('img');
      img.src = src;
      img.style.display = 'block';
      img.style.maxHeight = '80px';
      img.style.maxWidth = '100%';
      img.style.margin = '10px auto';
      img.style.border = '1px solid #eee';
      img.style.background = 'white';
      box.appendChild(img);
    } else {
      const ph = doc.createElement('div');
      ph.textContent = 'Signature non disponible';
      ph.style.minHeight = '60px';
      ph.style.border = '2px dashed #ccc';
      ph.style.display = 'flex';
      ph.style.alignItems = 'center';
      ph.style.justifyContent = 'center';
      ph.style.color = '#999';
      ph.style.fontStyle = 'italic';
      ph.style.margin = '10px 0';
      ph.style.background = '#f9f9f9';
      box.appendChild(ph);
    }

    if (date) {
      const p = doc.createElement('p');
      p.textContent = `Date de signature: ${date}`;
      p.style.margin = '6px 0 0';
      p.style.fontSize = '11px';
      p.style.color = '#555';
      box.appendChild(p);
    }

    return box;
  };

  section.appendChild(makeBox('Signature Client', clientSrc, clientDate));
  section.appendChild(makeBox('Signature Prestataire', companySrc, companyDate));
  root.appendChild(section);
};

const isCanvasMostlyWhite = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  const width = canvas.width;
  const height = canvas.height;
  if (width <= 0 || height <= 0) return false;

  const sampleW = Math.min(width, 1200);
  const sx = Math.floor((width - sampleW) / 2);
  const ys = [
    Math.floor(height * 0.15),
    Math.floor(height * 0.35),
    Math.floor(height * 0.55),
    Math.floor(height * 0.75),
    Math.floor(height * 0.9)
  ].map((y) => Math.max(0, Math.min(height - 1, y)));

  let whiteRows = 0;
  for (const y of ys) {
    try {
      const row = ctx.getImageData(sx, y, sampleW, 1).data;
      if (isRowMostlyWhite(row)) whiteRows++;
    } catch {
      return false;
    }
  }

  return whiteRows >= 4;
};

const stripUrlParams = (raw: string) => {
  const s = String(raw || '');
  const q = s.indexOf('?');
  const h = s.indexOf('#');
  const cut = q === -1 ? h : h === -1 ? q : Math.min(q, h);
  return cut === -1 ? s : s.slice(0, cut);
};

const withSwappedExtension = (raw: string, ext: string) => {
  const s = String(raw || '');
  if (!s) return s;
  const base = stripUrlParams(s);
  if (!/\.[a-z0-9]+$/i.test(base)) return s;
  return base.replace(/\.[a-z0-9]+$/i, `.${ext}`);
};

const getPathVariants = (raw: string) => {
  const candidates: string[] = [];
  const s = String(raw || '').trim();
  if (!s) return candidates;
  try {
    const u = new URL(s, window.location.origin);
    const pathname = u.pathname || '';
    if (pathname) {
      candidates.push(pathname);
      candidates.push(pathname.replace(/^\//, ''));
      candidates.push(`/${pathname.replace(/^\//, '')}`);
    }
  } catch {
    // ignore
  }
  return candidates;
};

const expandReplacementKeys = (raw: string) => {
  const baseKeys = [raw, stripUrlParams(raw), normalizeUrl(raw), stripUrlParams(normalizeUrl(raw))].filter(Boolean);
  const extra: string[] = [];

  for (const key of baseKeys) {
    if (key.startsWith('https://')) extra.push(`http://${key.slice('https://'.length)}`);
    if (key.startsWith('http://')) extra.push(`https://${key.slice('http://'.length)}`);
    if (key.startsWith('https://')) extra.push(`//${key.slice('https://'.length)}`);
    if (key.startsWith('http://')) extra.push(`//${key.slice('http://'.length)}`);

    if (key.includes('://www.')) extra.push(key.replace('://www.', '://'));
    if (key.includes('://') && !key.includes('://www.')) {
      const idx = key.indexOf('://') + 3;
      extra.push(`${key.slice(0, idx)}www.${key.slice(idx)}`);
    }
    if (key.startsWith('//www.')) extra.push(key.replace('//www.', '//'));
    if (key.startsWith('//') && !key.startsWith('//www.')) extra.push(`//www.${key.slice(2)}`);

    // png/webp variants
    extra.push(withSwappedExtension(key, 'png'));
    extra.push(withSwappedExtension(key, 'webp'));

    // relative path variants
    extra.push(...getPathVariants(key));
    extra.push(...getPathVariants(withSwappedExtension(key, 'png')));
    extra.push(...getPathVariants(withSwappedExtension(key, 'webp')));
  }

  return Array.from(new Set([...baseKeys, ...extra])).filter(Boolean);
};

const applyStringImageReplacements = (input: string, imageReplacements?: Record<string, string>) => {
  if (!imageReplacements) return input;

  let out = String(input || '');
  const entries = Object.entries(imageReplacements).filter(([, v]) => typeof v === 'string' && v.startsWith('data:image/'));
  if (entries.length === 0) return out;

  for (const [k, v] of entries) {
    const allKeys = expandReplacementKeys(k);
    for (const key of allKeys) {
      out = out.split(key).join(v);
    }
  }

  return out;
};

const findReplacement = (src: string, map: Record<string, string>) => {
  const candidates = expandReplacementKeys(src);
  for (const c of candidates) {
    const direct = map[c];
    if (direct) return direct;
  }
  return null;
};

const applyCssUrlReplacements = (doc: Document, imageReplacements: Record<string, string>) => {
  const replaceCss = (cssText: string) =>
    cssText.replace(/url\(([^)]+)\)/gi, (full, rawUrl) => {
      const cleaned = String(rawUrl || '').trim().replace(/^['"]|['"]$/g, '');
      const replacement = findReplacement(cleaned, imageReplacements);
      if (replacement && replacement.startsWith('data:image/')) {
        return `url("${replacement}")`;
      }
      return full;
    });

  const styleTags = Array.from(doc.querySelectorAll('style')) as HTMLStyleElement[];
  for (const st of styleTags) {
    const txt = st.textContent || '';
    const next = replaceCss(txt);
    if (next !== txt) st.textContent = next;
  }

  const inlineStyled = Array.from(doc.querySelectorAll('[style]')) as HTMLElement[];
  for (const el of inlineStyled) {
    const txt = el.getAttribute('style') || '';
    const next = replaceCss(txt);
    if (next !== txt) el.setAttribute('style', next);
  }
};

const applyImageReplacements = (doc: Document, imageReplacements?: Record<string, string>) => {
  if (!imageReplacements) return;
  const entries = Object.entries(imageReplacements).filter(([, v]) => typeof v === 'string' && v.trim());
  if (entries.length === 0) return;

  applyCssUrlReplacements(doc, imageReplacements);

  const imgs = Array.from(doc.querySelectorAll('img')) as HTMLImageElement[];
  for (const img of imgs) {
    const src = img.getAttribute('src') || '';
    const replacement = findReplacement(src, imageReplacements);
    if (replacement && replacement.startsWith('data:image/')) {
      img.setAttribute('crossorigin', 'anonymous');
      img.removeAttribute('srcset');
      img.src = replacement;
    }
  }
};

const injectSignatures = (doc: Document, signatureImages?: HtmlPdfOptions['signatureImages'], signatureDates?: HtmlPdfOptions['signatureDates']) => {
  if (!signatureImages) return;

  const clientSrc = signatureImages.client || '';
  const companySrc = signatureImages.companyStamp || signatureImages.company || '';

  const signatureRoot = (doc.querySelector('.pdf-root') as HTMLElement | null) || doc.body;

  const addDateLine = (box: HTMLElement, dateText: string) => {
    if (!dateText) return;
    const already = Array.from(box.querySelectorAll('p,small,div,span')).some((el) =>
      String(el.textContent || '').toLowerCase().includes('date de signature') || String(el.textContent || '').toLowerCase().includes('signé le')
    );
    if (already) return;
    const p = doc.createElement('p');
    p.textContent = `Date de signature: ${dateText}`;
    p.style.fontSize = '11px';
    p.style.color = '#555';
    p.style.margin = '6px 0 0';
    p.style.textAlign = 'center';
    box.appendChild(p);
  };

  const boxes = Array.from(signatureRoot.querySelectorAll('.signature-box')) as HTMLElement[];
  if (boxes.length === 0) return;

  for (const box of boxes) {
    const label = (box.textContent || '').toLowerCase();
    const imgEl = box.querySelector('img') as HTMLImageElement | null;
    const hasImg = !!imgEl;

    if (clientSrc && (label.includes('client') || label.includes('signature du client'))) {
      if (imgEl) {
        imgEl.setAttribute('crossorigin', 'anonymous');
        imgEl.src = clientSrc;
      } else {
        const img = doc.createElement('img');
        img.src = clientSrc;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '80px';
        img.style.display = 'block';
        img.style.margin = '10px auto 0';
        box.appendChild(img);
      }
      if (signatureDates?.client) addDateLine(box, String(signatureDates.client));
      continue;
    }

    if (companySrc && (label.includes('entreprise') || label.includes('prestataire') || label.includes("signature de l'entreprise"))) {
      if (imgEl) {
        imgEl.setAttribute('crossorigin', 'anonymous');
        imgEl.src = companySrc;
      } else {
        const img = doc.createElement('img');
        img.src = companySrc;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '80px';
        img.style.display = 'block';
        img.style.margin = '10px auto 0';
        box.appendChild(img);
      }
      if (signatureDates?.company) addDateLine(box, String(signatureDates.company));
      continue;
    }

    if (hasImg && imgEl) {
      const src = imgEl.getAttribute('src') || '';
      if (clientSrc && (label.includes('client') || label.includes('signature du client')) && !src.startsWith('data:image/')) {
        imgEl.setAttribute('crossorigin', 'anonymous');
        imgEl.src = clientSrc;
      }
      if (companySrc && (label.includes('entreprise') || label.includes('prestataire') || label.includes("signature de l'entreprise")) && !src.startsWith('data:image/')) {
        imgEl.setAttribute('crossorigin', 'anonymous');
        imgEl.src = companySrc;
      }
    }
  }
};

const isRowMostlyWhite = (data: Uint8ClampedArray, threshold = 248) => {
  // data is RGBA for sampled pixels; treat pixel as white if RGB are high.
  const pxCount = Math.floor(data.length / 4);
  let white = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r >= threshold && g >= threshold && b >= threshold) white++;
  }
  return white / Math.max(1, pxCount) > 0.92;
};

const findSafeBreakY = (canvas: HTMLCanvasElement, startY: number, targetHeight: number) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return startY + targetHeight;

  const width = canvas.width;
  const endY = Math.min(canvas.height, startY + targetHeight);
  const searchPx = Math.min(80, Math.max(20, Math.floor(targetHeight * 0.08)));

  // sample a thin strip near bottom and look upwards for a mostly-white row
  const sampleW = Math.min(width, 1200);
  const sx = Math.floor((width - sampleW) / 2);

  for (let y = endY; y >= Math.max(startY + Math.floor(targetHeight * 0.55), endY - searchPx); y--) {
    try {
      const row = ctx.getImageData(sx, y, sampleW, 1).data;
      if (isRowMostlyWhite(row)) return y;
    } catch {
      // ignore
    }
  }

  return endY;
};

const isEffectivelyEmpty = (node: HTMLElement) => {
  const text = (node.textContent || '').replace(/\s+/g, '').trim();
  const hasText = text.length > 0;
  const hasMedia = !!node.querySelector('img,svg,canvas,table');
  return !hasText && !hasMedia;
};

export const downloadHtmlAsPdf = async ({ html, filename, title, extraCss, zoom = 0.93, signatureImages, signatureDates, imageReplacements }: HtmlPdfOptions) => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '210mm';
  iframe.style.height = '297mm';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');

  const defaultCss = buildContractPdfCss();
  const resolvedHtml = applyStringImageReplacements(html, imageReplacements);
  const resolvedExtraCss = applyStringImageReplacements(extraCss || '', imageReplacements);
  const bodyHtml = extractBodyHtml(resolvedHtml);
  const headStyleTags = extractHeadStyleTags(resolvedHtml);
  const bodyStyle = extractBodyStyleAttr(resolvedHtml);

  const docHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${String(title || filename || 'Document')}</title>
${headStyleTags}
<style>${defaultCss}\n${resolvedExtraCss}</style>
</head>
<body${bodyStyle ? ` style="${bodyStyle.replace(/\"/g, '&quot;')}"` : ''}>
  <div class="pdf-zoom">
    <div class="pdf-root">${bodyHtml}</div>
  </div>
</body>
</html>`;

  document.body.appendChild(iframe);

  await new Promise<void>((resolve, reject) => {
    iframe.onload = () => resolve();
    try {
      iframe.srcdoc = docHtml;
    } catch (e) {
      reject(e);
    }
  });

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;

  if (!doc || !win) {
    document.body.removeChild(iframe);
    throw new Error('Impossible de créer le document PDF (iframe).');
  }

  try {
    const anyDoc = doc as any;
    if (anyDoc.fonts && anyDoc.fonts.ready) {
      await anyDoc.fonts.ready;
    }

    applyImageReplacements(doc, imageReplacements);
    injectLogoIfMissing(doc, imageReplacements);
    injectSignatureSectionIfMissing(doc, signatureImages, signatureDates);
    injectSignatures(doc, signatureImages, signatureDates);
    await waitForImages(doc);

    const root = doc.querySelector('.pdf-root') as HTMLElement | null;
    if (!root) throw new Error('Contenu HTML introuvable pour le rendu PDF.');

    const pageCandidates = Array.from(root.querySelectorAll(':scope > div')) as HTMLElement[];
    const rawPages = pageCandidates.length > 0 ? pageCandidates : [root];
    const pages = rawPages.filter(p => !isEffectivelyEmpty(p));
    const finalPages = pages.length > 0 ? pages : rawPages;

    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    });

    const pdfPageWidth = pdf.internal.pageSize.getWidth();
    const pdfPageHeight = pdf.internal.pageSize.getHeight();

    const effectiveZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
    const targetWidthMm = pdfPageWidth * effectiveZoom;
    const offsetX = (pdfPageWidth - targetWidthMm) / 2;

    let outputIndex = 0;
    for (let i = 0; i < finalPages.length; i++) {
      const node = finalPages[i];
      const canvas = await html2canvas(node, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: false,
        windowWidth: doc.documentElement.scrollWidth,
        windowHeight: doc.documentElement.scrollHeight
      });

      if (isCanvasMostlyWhite(canvas)) {
        continue;
      }

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = targetWidthMm;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (imgHeight <= pdfPageHeight * 1.02) {
        const ratio = Math.min(1, pdfPageHeight / imgHeight);
        const drawWidth = imgWidth * ratio;
        const drawHeight = imgHeight * ratio;
        const x = offsetX + (imgWidth - drawWidth) / 2;
        if (outputIndex > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', x, 0, drawWidth, drawHeight, undefined, 'FAST');
        outputIndex++;
        continue;
      }

      const mmPerPx = imgWidth / canvas.width;
      const pageHeightPx = pdfPageHeight / mmPerPx;

      let y = 0;
      while (y < canvas.height) {
        const rawSliceHeightPx = Math.min(pageHeightPx, canvas.height - y);
        const breakY = findSafeBreakY(canvas, y, rawSliceHeightPx);
        const sliceHeightPx = Math.max(1, Math.min(rawSliceHeightPx, breakY - y));

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHeightPx;

        const ctx = sliceCanvas.getContext('2d');
        if (!ctx) break;

        ctx.drawImage(canvas, 0, y, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);

        if (isCanvasMostlyWhite(sliceCanvas)) {
          y += sliceHeightPx;
          continue;
        }

        const sliceImgData = sliceCanvas.toDataURL('image/png');
        const sliceHeightMm = sliceHeightPx * mmPerPx;

        if (outputIndex > 0) pdf.addPage();
        pdf.addImage(sliceImgData, 'PNG', offsetX, 0, imgWidth, sliceHeightMm, undefined, 'FAST');

        outputIndex++;

        y += sliceHeightPx;
      }
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(iframe);
  }
};
