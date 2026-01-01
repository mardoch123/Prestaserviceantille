import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { LOGO_BASE64, LOGO_SAP_BASE64, SIGNATURE_BASE64, STAMP_SIGNATURE_BASE64 } from '../src/assets/images';
import { formatPDFDate } from '../src/utils/dayjsMartinique';

const COMPANY_STAMP_LOCAL_SRC = new URL('../src/assets/images/cachetetsignature.webp', import.meta.url).toString();

// Fonction pour convertir une URL en base64 ou retourner la valeur base64 existante
const getSignatureImage = (signature: string | undefined): string | null => {
  if (!signature) return null;
  
  // Si c'est déjà en base64, le retourner directement
  if (signature.startsWith('data:image/')) {
    console.log('Using base64 signature');
    return signature;
  }

  // Si c'est une base64 brute (sans préfixe data:image)
  if (/^[A-Za-z0-9+/]+=*$/.test(signature) && signature.length > 200) {
    console.log('Using raw base64 signature');
    return `data:image/png;base64,${signature}`;
  }

  // Si c'est une URL (ex: supabase storage), on la retourne directement
  if (/^https?:\/\//i.test(signature)) {
    console.log('Using URL signature');
    return signature;
  }
  
  // Si c'est une URL, utiliser les constantes base64 disponibles
  if (signature.includes('https://prestaservicesantilles.com/signature.png')) {
    console.log('Using SIGNATURE_BASE64 for company signature');
    return SIGNATURE_BASE64;
  }
  
  // Si c'est une autre URL, utiliser le cachet de l'entreprise
  if (signature.includes('prestaservicesantilles.com')) {
    console.log('Using STAMP_SIGNATURE_BASE64 for company stamp');
    return STAMP_SIGNATURE_BASE64;
  }
  
  console.log('Unknown signature format, using null');
  return null;
};

const getAnyImageSrc = (src: string | undefined): string | null => {
  if (!src) return null;
  const s = String(src || '').trim();
  if (!s) return null;
  if (s.startsWith('data:image/')) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return s;
};

// Fonction pour nettoyer le HTML et les caractères spéciaux
const cleanHTML = (text: string): string => {
  if (!text) return '';
  
  // Supprimer les balises HTML
  let cleaned = text.replace(/<[^>]*>/g, '');
  
  // Remplacer les entités HTML courantes
  const htmlEntities: { [key: string]: string } = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&agrave;': 'à',
    '&egrave;': 'è',
    '&ugrave;': 'ù',
    '&acirc;': 'â',
    '&ecirc;': 'ê',
    '&icirc;': 'î',
    '&ocirc;': 'ô',
    '&ucirc;': 'û',
    '&eacute;': 'é',
    '&ccedil;': 'ç',
    '&nbsp;': ' ',
    '&mdash;': '—',
    '&ndash;': '–',
    '&rsquo;': '\'',
    '&lsquo;': '\'',
    '&ldquo;': '\"',
    '&rdquo;': '\"'
  };
  
  Object.entries(htmlEntities).forEach(([entity, char]) => {
    cleaned = cleaned.replace(new RegExp(entity, 'g'), char);
  });
  
  // Nettoyer les caractères bizarres et indésirables de manière plus agressive
  cleaned = cleaned
    .replace(/[^\x20-\x7E\u00C0-\u017F\u0180-\u024F\u1E00-\u1EFF]/g, '') // Garder ASCII, latin étendu et caractères européens
    .replace(/[^\w\s\u00C0-\u017F.,;:!?'"()\-\/@&%]/g, '') // Garder ponctuation de base et caractères utiles
    .replace(/\s+/g, ' ') // Normaliser les espaces
    .trim();
  
  return cleaned;
};

// Variante: préserver les retours à la ligne (utile pour le contenu du contrat)
const cleanHTMLPreserveLineBreaks = (text: string): string => {
  if (!text) return '';

  let cleaned = text;

  cleaned = cleaned
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*p\s*>/gi, '\n')
    .replace(/<\s*\/\s*div\s*>/gi, '\n')
    .replace(/<\s*\/\s*li\s*>/gi, '\n')
    .replace(/<\s*li\b[^>]*>/gi, '• ');

  // Supprimer le reste des balises HTML
  cleaned = cleaned.replace(/<[^>]*>/g, '');

  // Décoder quelques entités usuelles (sans casser les retours ligne)
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&eacute;': 'é',
    '&egrave;': 'è',
    '&agrave;': 'à',
    '&ccedil;': 'ç',
    '&nbsp;': ' '
  };

  Object.entries(entities).forEach(([k, v]) => {
    cleaned = cleaned.split(k).join(v);
  });

  // Normaliser les espaces, mais garder \n
  cleaned = cleaned
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\t ]+/g, ' ')
    .replace(/ \n/g, '\n')
    .replace(/\n /g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleaned;
};

const formatContractText = (text: string): string => {
  const base = cleanHTMLPreserveLineBreaks(text);
  // Ajouter de l'air autour des "Article X" pour une lecture plus claire
  return base
    .replace(/\n?(Article\s+\d+[^\n]*)/gi, '\n\n$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const renderContractRichText = (value: string) => {
  const formatted = formatContractText(value || '');
  const paragraphs = formatted.split(/\n\n+/g);

  return (
    <View>
      {paragraphs.map((para, pIndex) => {
        const trimmed = (para || '').trim();
        if (!trimmed) {
          return null;
        }

        const isArticleParagraph = /^article\b/i.test(trimmed);
        const segments = trimmed.split(/(Article)/gi);

        return (
          <Text
            key={`p-${pIndex}`}
            style={isArticleParagraph ? [styles.contractParagraph, styles.contractArticleParagraph] : styles.contractParagraph}
            wrap
            minPresenceAhead={60}
          >
            {segments.map((seg, sIndex) => {
              if (/^article$/i.test(seg)) {
                return (
                  <Text key={`seg-${pIndex}-${sIndex}`} style={styles.contractWordArticle}>
                    {seg}
                  </Text>
                );
              }
              return <Text key={`seg-${pIndex}-${sIndex}`}>{seg}</Text>;
            })}
          </Text>
        );
      })}
    </View>
  );
};

const isProbablyHtml = (value: string) => {
  const v = String(value || '').trim();
  if (!v) return false;
  return /<\s*\w+[\s\S]*>/.test(v);
};

const parseInlineStyle = (styleValue: string): any => {
  const style: any = {};
  const raw = String(styleValue || '');
  raw
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)
    .forEach(rule => {
      const idx = rule.indexOf(':');
      if (idx < 0) return;
      const key = rule.slice(0, idx).trim().toLowerCase();
      const val = rule.slice(idx + 1).trim();

      if (key === 'font-weight' && /bold|600|700|800|900/i.test(val)) style.fontWeight = 'bold';
      if (key === 'font-style' && /italic/i.test(val)) style.fontStyle = 'italic';
      if (key === 'text-decoration' && /underline/i.test(val)) style.textDecoration = 'underline';
      if (key === 'color' && val) style.color = val;
      if (key === 'text-align' && /left|right|center|justify/i.test(val)) style.textAlign = val;
      if (key === 'font-size') {
        const num = Number(String(val).replace(/px/i, '').trim());
        if (!Number.isNaN(num) && num > 0) style.fontSize = Math.min(Math.max(num, 8), 20);
      }
    });
  return style;
};

const renderContractHtml = (html: string) => {
  const tokens = String(html || '').split(/(<[^>]+>)/g).filter(Boolean);
  const blocks: Array<{ segments: Array<{ text: string; style?: any }>; blockStyle?: any }> = [];

  let currentSegments: Array<{ text: string; style?: any }> = [];
  let currentBlockStyle: any = {};
  const styleStack: any[] = [{}];

  const pushBlock = () => {
    const mergedText = currentSegments.map(s => s.text).join('');
    if (!mergedText.trim()) {
      currentSegments = [];
      currentBlockStyle = {};
      return;
    }
    blocks.push({ segments: currentSegments, blockStyle: currentBlockStyle });
    currentSegments = [];
    currentBlockStyle = {};
  };

  const appendText = (text: string) => {
    const cleaned = cleanHTMLPreserveLineBreaks(String(text || ''));
    if (!cleaned) return;
    const active = styleStack[styleStack.length - 1] || {};
    currentSegments.push({ text: cleaned, style: active });
  };

  for (const token of tokens) {
    if (!token.startsWith('<')) {
      appendText(token);
      continue;
    }

    const isClosing = /^<\s*\//.test(token);
    const tagName = String(token.replace(/<\s*\/?\s*([a-zA-Z0-9]+)[\s\S]*?>/, '$1') || '').toLowerCase();
    const isSelfClosing = /\/\s*>$/.test(token) || /<\s*br\s*\/?\s*>/i.test(token);

    if (tagName === 'br') {
      appendText('\n');
      continue;
    }

    if (isClosing) {
      if (tagName === 'p' || tagName === 'div' || tagName === 'li' || tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'h4') {
        pushBlock();
      }

      if (tagName === 'span' || tagName === 'strong' || tagName === 'b' || tagName === 'em' || tagName === 'i' || tagName === 'u') {
        if (styleStack.length > 1) styleStack.pop();
      }
      continue;
    }

    if (tagName === 'p' || tagName === 'div') {
      pushBlock();
      const styleMatch = token.match(/style\s*=\s*"([^"]*)"/i);
      const blockStyle = styleMatch ? parseInlineStyle(styleMatch[1]) : {};
      if (blockStyle.textAlign) currentBlockStyle.textAlign = blockStyle.textAlign;
      continue;
    }

    if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'h4') {
      pushBlock();
      const sizes: Record<string, number> = { h1: 16, h2: 14, h3: 12, h4: 11 };
      currentBlockStyle = { fontWeight: 'bold', fontSize: sizes[tagName] || 12 };
      continue;
    }

    if (tagName === 'ul' || tagName === 'ol') {
      pushBlock();
      continue;
    }

    if (tagName === 'li') {
      pushBlock();
      appendText('• ');
      continue;
    }

    if (tagName === 'strong' || tagName === 'b') {
      styleStack.push({ ...(styleStack[styleStack.length - 1] || {}), fontWeight: 'bold' });
      continue;
    }

    if (tagName === 'em' || tagName === 'i') {
      styleStack.push({ ...(styleStack[styleStack.length - 1] || {}), fontStyle: 'italic' });
      continue;
    }

    if (tagName === 'u') {
      styleStack.push({ ...(styleStack[styleStack.length - 1] || {}), textDecoration: 'underline' });
      continue;
    }

    if (tagName === 'span') {
      const styleMatch = token.match(/style\s*=\s*"([^"]*)"/i);
      const inlineStyle = styleMatch ? parseInlineStyle(styleMatch[1]) : {};
      const base = styleStack[styleStack.length - 1] || {};
      styleStack.push({ ...base, ...inlineStyle, textAlign: base.textAlign });
      continue;
    }

    if (isSelfClosing) {
      continue;
    }
  }

  pushBlock();

  return (
    <View>
      {blocks.map((b, i) => (
        <Text key={`html-b-${i}`} style={[styles.contractParagraph, b.blockStyle || {}]} wrap minPresenceAhead={60}>
          {(b.segments || []).map((s, j) => (
            <Text key={`html-s-${i}-${j}`} style={s.style || {}}>
              {s.text}
            </Text>
          ))}
        </Text>
      ))}
    </View>
  );
};

const renderContractContent = (value: string) => {
  if (isProbablyHtml(value)) return renderContractHtml(value);
  return renderContractRichText(value);
};

// Enregistrement de polices personnalisées
Font.register({
  family: 'Helvetica',
  src: 'https://fonts.googleapis.com/css2?family=Helvetica:wght@300;400;700&display=swap'
});

const styles = StyleSheet.create({
  page: {
    fontSize: 11,
    padding: 40,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  pageInvoice: {
    fontSize: 7.6,
    padding: 16,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  pageQuote: {
    fontSize: 6.2,
    padding: 14,
    paddingBottom: 52,
  },
  pageContract: {
    fontSize: 10,
    padding: 28,
  },
  header: {
    marginBottom: 30,
    borderBottomWidth: 2,
    borderBottomColor: '#1a1a1a',
    borderBottomStyle: 'solid',
    paddingBottom: 20,
  },
  headerInvoice: {
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  headerInvoiceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  headerInvoiceInfoBlock: {
    flex: 1,
    alignItems: 'flex-end',
  },
  headerQuote: {
    marginBottom: 10,
    paddingBottom: 8,
  },
  headerContract: {
    marginBottom: 16,
    paddingBottom: 12,
  },
  headerCard: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#F2F7FB',
    borderWidth: 1,
    borderColor: '#D7E7F2',
    borderStyle: 'solid',
  },
  headerCardQuote: {
    padding: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  headerTextBlock: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#1a1a1a',
  },
  titleInvoice: {
    fontSize: 12,
    marginBottom: 2,
    textAlign: 'right',
  },
  titleQuote: {
    fontSize: 13,
    marginBottom: 3,
    textAlign: 'right',
  },
  titleBrand: {
    color: '#0B5FA5',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    marginBottom: 5,
  },
  subtitleInvoice: {
    fontSize: 7,
    marginBottom: 1,
    textAlign: 'right',
  },
  subtitleSmall: {
    fontSize: 10,
    textAlign: 'center',
    color: '#4B5563',
    marginBottom: 3,
  },
  subtitleSmallQuote: {
    fontSize: 7.2,
    marginBottom: 2,
    textAlign: 'right',
  },

  headerTextBlockQuote: {
    alignItems: 'flex-end',
  },
  logo: {
    width: 140,
    height: 140,
    marginBottom: 12,
    alignSelf: 'center',
  },
  logoInvoice: {
    width: 46,
    height: 46,
    marginBottom: 0,
    alignSelf: 'flex-start',
    objectFit: 'contain',
  },
  logoSmall: {
    width: 74,
    height: 74,
  },
  logoPlaceholder: {
    width: 140,
    height: 140,
    marginBottom: 12,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderStyle: 'solid',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  logoPlaceholderInvoice: {
    width: 58,
    height: 58,
    marginBottom: 0,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#ccc',
    borderStyle: 'solid',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  placeholderText: {
    fontSize: 12,
    color: '#999',
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 20,
  },
  sectionInvoice: {
    marginBottom: 6,
  },
  sectionQuote: {
    marginBottom: 8,
  },
  sectionCompact: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  sectionTitleBrand: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#0B5FA5',
  },
  sectionTitleBrandInvoice: {
    fontSize: 9,
    marginBottom: 3,
  },
  sectionTitleInvoice: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 3,
    color: '#1a1a1a',
  },
  card: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'solid',
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  cardInvoice: {
    padding: 6,
    borderRadius: 6,
  },
  cardQuote: {
    padding: 8,
  },
  cardTint: {
    backgroundColor: '#FBFDFF',
    borderColor: '#D7E7F2',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  rowInvoice: {
    marginBottom: 1,
  },
  rowQuote: {
    marginBottom: 3,
  },
  rowTight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  label: {
    fontWeight: 'bold',
    color: '#333',
  },
  labelBrand: {
    fontWeight: 'bold',
    color: '#0B5FA5',
  },
  boldInlineLabel: {
    fontWeight: 'bold',
    color: '#333',
  },
  value: {
    color: '#666',
  },
  valueDark: {
    color: '#111827',
  },
  table: {
    width: '100%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 20,
  },
  tableInvoice: {
    marginBottom: 6,
  },
  tableQuote: {
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    borderBottomStyle: 'solid',
  },
  tableHeader: {
    backgroundColor: '#f8f9fa',
    fontWeight: 'bold',
  },
  tableHeaderBrand: {
    backgroundColor: '#0B5FA5',
    color: 'white',
  },
  tableCell: {
    padding: 8,
    flex: 1,
    textAlign: 'center',
  },
  tableCellInvoice: {
    padding: 3,
    fontSize: 7,
  },
  descriptionCellInvoice: {
    flex: 3,
    textAlign: 'left',
    fontSize: 7,
  },
  tableCellQuote: {
    padding: 4,
    fontSize: 7,
  },
  descriptionCell: {
    flex: 3,
    textAlign: 'left',
  },
  descriptionCellQuote: {
    fontSize: 7,
  },
  totalSection: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    borderTopStyle: 'solid',
    paddingTop: 10,
  },
  totalSectionInvoice: {
    marginTop: 6,
    paddingTop: 4,
  },
  totalSectionQuote: {
    marginTop: 8,
    paddingTop: 6,
  },
  totalCard: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D7E7F2',
    borderStyle: 'solid',
    padding: 12,
    backgroundColor: '#F2F7FB',
  },
  totalCardInvoice: {
    marginTop: 4,
    padding: 6,
    borderRadius: 6,
  },
  totalCardQuote: {
    marginTop: 6,
    padding: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  totalRowInvoice: {
    marginBottom: 2,
  },
  grandTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  grandTotalBrand: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0B5FA5',
  },
  signatureSection: {
    marginTop: 50,
  },
  signatureSectionQuote: {
    marginTop: 12,
  },
  signatureSectionContract: {
    marginTop: 12,
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
  },
  signatureRowQuote: {
    marginTop: 8,
  },
  signatureRowContract: {
    marginTop: 10,
  },
  signatureBox: {
    width: '45%',
    borderTopWidth: 1,
    borderTopColor: '#333',
    borderTopStyle: 'solid',
    paddingTop: 5,
    minHeight: 150,
  },
  signatureBoxCard: {
    width: '45%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'solid',
    padding: 10,
    backgroundColor: '#FFFFFF',
    minHeight: 170,
  },
  signatureBoxCardQuote: {
    padding: 8,
    minHeight: 100,
  },
  signatureBoxCardContract: {
    padding: 8,
    minHeight: 120,
  },
  signatureText: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  signatureTextQuote: {
    marginBottom: 10,
  },
  signatureTextContract: {
    marginBottom: 10,
  },
  signatureCaption: {
    fontSize: 9,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  signatureCaptionQuote: {
    fontSize: 7.5,
    marginTop: 2,
  },
  signatureMetaCenterQuote: {
    textAlign: 'center',
    fontSize: 7.5,
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    borderTopStyle: 'solid',
    paddingTop: 10,
  },
  footerInvoice: {
    bottom: 10,
    left: 18,
    right: 18,
    fontSize: 6.6,
    paddingTop: 4,
  },
  twoColRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  col48: {
    width: '48%',
  },
  footerQuote: {
    bottom: 8,
    left: 18,
    right: 18,
    fontSize: 7,
    paddingTop: 6,
  },
  statusBadge: {
    backgroundColor: '#28a745',
    color: 'white',
    padding: 4,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    alignSelf: 'flex-start',
  },
  statusBadgeInvoice: {
    padding: 2,
    borderRadius: 3,
    fontSize: 7,
  },
  pendingBadge: {
    backgroundColor: '#ffc107',
    color: '#212529',
  },
  paidBadge: {
    backgroundColor: '#dc3545',
    color: 'white',
  },
  list: {
    marginTop: 6,
  },
  listInvoice: {
    marginTop: 3,
  },
  listItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  listItemRowInvoice: {
    justifyContent: 'flex-start',
    marginBottom: 2,
  },
  listBullet: {
    width: 14,
    color: '#0B5FA5',
    fontWeight: 'bold',
  },
  listBulletInvoice: {
    width: 10,
  },
  listText: {
    flex: 1,
    color: '#374151',
    fontSize: 10,
  },
  listTextInvoice: {
    fontSize: 7,
    lineHeight: 1.15,
  },
  listTextQuote: {
    fontSize: 7,
  },

  placeholderTextInvoice: {
    fontSize: 9,
  },

  signatureImage: {
    width: 140,
    height: 80,
    marginBottom: 5,
  },
  signatureImageQuote: {
    width: 110,
    height: 60,
    objectFit: 'contain',
    alignSelf: 'center',
  },
  companyStampImage: {
    width: 190,
    height: 110,
    marginBottom: 5,
    objectFit: 'contain',
  },
  companyStampImageQuote: {
    width: 120,
    height: 70,
    objectFit: 'contain',
    alignSelf: 'center',
    marginBottom: 4,
  },

  contractContentCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'solid',
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  contractContentCardContract: {
    padding: 8,
  },
  contractParagraph: {
    fontSize: 11,
    lineHeight: 1.4,
    color: '#111827',
    marginBottom: 6,
  },
  contractParagraphContract: {
    fontSize: 9.5,
    lineHeight: 1.25,
    marginBottom: 4,
  },
  contractArticleParagraph: {
    backgroundColor: '#F2F7FB',
    padding: 6,
    borderRadius: 6,
  },
  contractWordArticle: {
    fontWeight: 'bold',
  },
});

// Composant pour le devis signé
export const SignedQuotePDF = ({ doc, packs }: { doc: any, packs?: any[] }) => (
  <Document>
    <Page size="A4" style={[styles.page, styles.pageQuote]}>
      <View style={[styles.header, styles.headerQuote]}>
        {(() => {
          try {
            const resolvedTvaRate = typeof doc.tvaRate === 'number' ? doc.tvaRate : (doc.tvaRate ? Number(doc.tvaRate) : 0);
            const logo = doc.logoBase64 || ((resolvedTvaRate || 0) === 0 ? LOGO_SAP_BASE64 : LOGO_BASE64);
            console.log('Logo selection - TVA Rate:', doc.tvaRate, 'Logo type:', (doc.tvaRate || 0) === 0 ? 'SAP' : 'Normal');
            console.log('Logo data length:', logo ? logo.length : 'undefined');
            console.log('Logo starts with data:image:', logo ? logo.startsWith('data:image/') : false);
            
            return (
              <View style={[styles.headerCard, styles.headerCardQuote]}>
                <View style={styles.headerTopRow}>
                  {logo && logo.startsWith('data:image/') ? (
                    <Image src={logo} style={[styles.logo, styles.logoSmall]} />
                  ) : (
                    <View style={[styles.logoPlaceholder, { width: 74, height: 74, marginBottom: 0 }]}>
                      <Text style={styles.placeholderText}>LOGO</Text>
                    </View>
                  )}
                  <View style={[styles.headerTextBlock, styles.headerTextBlockQuote]}>
                    <Text style={[styles.title, styles.titleBrand, styles.titleQuote]}>{doc.status === 'signed' ? 'DEVIS SIGNÉ' : 'DEVIS'}</Text>
                    <Text style={[styles.subtitleSmall, styles.subtitleSmallQuote]}>
                        Presta Services Antilles - SIRET: 944 789 700 00019{"\n"}
                        Email : prestaservicesantilles.rh@gmail.com
                    </Text>
                    <Text style={[styles.subtitleSmall, styles.subtitleSmallQuote]}>Téléphone: +596 0696 06 15 94 - www.prestaservicesantilles.com</Text>
                  </View>
                </View>
              </View>
            );
          } catch (error) {
            console.error('Error rendering logo:', error);
            return (
              <View style={[styles.headerCard, styles.headerCardQuote]}>
                <Text style={[styles.title, styles.titleBrand, styles.titleQuote]}>{doc.status === 'signed' ? 'DEVIS SIGNÉ' : 'DEVIS'}</Text>
        
                  <Text style={[styles.subtitleSmall, styles.subtitleSmallQuote]}>
                      Presta Services Antilles - SIRET: 944 789 700 00019{"\n"}
                      Email : prestaservicesantilles.rh@gmail.com
                  </Text>
                <Text style={[styles.subtitleSmall, styles.subtitleSmallQuote]}>Téléphone: +596 0696 06 15 94 - www.prestaservicesantilles.com</Text>
              </View>
            );
          }
        })()}
      </View>

      <View style={[styles.section, styles.sectionQuote]}>
        <Text style={styles.sectionTitleBrand}>Informations Client</Text>
        <View style={[styles.card, styles.cardQuote]}>
          <View style={[styles.row, styles.rowQuote]}>
            <Text style={styles.label}>Nom:</Text>
            <Text style={styles.value}>{doc.clientName}</Text>
          </View>
          <View style={[styles.row, styles.rowQuote]}>
            <Text style={styles.label}>Email:</Text>
            <Text style={styles.value}>{doc.clientEmail}</Text>
          </View>
          <View style={[styles.row, styles.rowQuote]}>
            <Text style={styles.label}>Téléphone:</Text>
            <Text style={styles.value}>{doc.clientPhone}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.section, styles.sectionQuote]}>
        <View style={[styles.card, styles.cardTint, styles.cardQuote]}>
          <View style={[styles.row, styles.rowQuote]}>
            <Text style={styles.labelBrand}>Référence:</Text>
            <Text style={styles.valueDark}>{doc.ref}</Text>
          </View>
          <View style={[styles.row, styles.rowQuote]}>
            <Text style={styles.labelBrand}>Date:</Text>
            <Text style={styles.valueDark}>
              {formatPDFDate(doc.date)}
            </Text>
          </View>
          <View style={[styles.row, styles.rowQuote]}>
            <Text style={styles.labelBrand}>Statut:</Text>
            {(() => {
              const normalizedStatus = typeof doc.status === 'string' ? doc.status.trim().toLowerCase() : '';
              const effectiveStatus = normalizedStatus || (doc.signed ? 'signed' : '');
              const label = effectiveStatus === 'signed' ? 'SIGNÉ' : effectiveStatus === 'sent' ? 'ENVOYÉ' : 'BROUILLON';
              return (
                <View style={[styles.statusBadge, effectiveStatus === 'signed' ? {} : styles.pendingBadge]}>
                  <Text>{label}</Text>
                </View>
              );
            })()}
          </View>
        </View>
      </View>

      {(() => {
        const slots = Array.isArray(doc.slotsData) ? doc.slotsData : [];
        if (slots.length === 0) return null;
        const totalHours = slots.reduce((acc: number, s: any) => acc + (Number(s?.duration) || 0), 0);

        return (
          <View style={[styles.section, styles.sectionQuote]} wrap={false}>
            <Text style={styles.sectionTitleBrand}>Interventions</Text>
            <View style={[styles.card, styles.cardTint, styles.cardQuote]}>
              <View style={[styles.row, styles.rowQuote]}>
                <Text style={styles.labelBrand}>Nombre de jours:</Text>
                <Text style={styles.valueDark}>{slots.length} jour(s)</Text>
              </View>
              <View style={[styles.row, styles.rowQuote]}>
                <Text style={styles.labelBrand}>Total d'heures:</Text>
                <Text style={styles.valueDark}>{totalHours}h</Text>
              </View>
              <View style={styles.list}>
                {slots.map((slot: any, index: number) => (
                  <View key={index} style={styles.listItemRow}>
                    <Text style={styles.listBullet}>{index + 1}.</Text>
                    <Text style={[styles.listText, styles.listTextQuote]}>
                      {cleanHTML(String(slot?.date || ''))} - {cleanHTML(String(slot?.startTime || ''))} à {cleanHTML(String(slot?.endTime || ''))}
                      {slot?.duration ? ` (${cleanHTML(String(slot.duration))}h)` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        );
      })()}

      <View style={[styles.section, styles.sectionQuote]}>
        <Text style={styles.sectionTitleBrand}>Détails du Devis</Text>
        <View style={[styles.table, styles.tableQuote]}>
          <View style={[styles.tableRow, styles.tableHeader, styles.tableHeaderBrand]}>
            <Text style={[styles.tableCell, styles.tableCellQuote, styles.descriptionCell, styles.descriptionCellQuote]}>Description</Text>
            <Text style={[styles.tableCell, styles.tableCellQuote]}>Quantité</Text>
            <Text style={[styles.tableCell, styles.tableCellQuote]}>Prix Unit.</Text>
            <Text style={[styles.tableCell, styles.tableCellQuote]}>Total</Text>
          </View>

          {(() => {
            // Ligne "Interventions: X jour(s)" supprimée (demande UX)
            return null;
          })()}

          {doc.items?.map((item: any, index: number) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.tableCellQuote, styles.descriptionCell, styles.descriptionCellQuote]}>
                {(() => {
                  const resolvedPackId = doc.packId;
                  const resolvedPackName = doc.packName || (resolvedPackId ? (packs || []).find((p: any) => p.id === resolvedPackId)?.name : '') || '';
                  const resolvedPackNameFromId = String(
                    doc.packId ? (packs || []).find((p: any) => p.id === doc.packId)?.name : ''
                  );
                  const resolvedPackNameFromField = String(doc.packName || '').trim();
                  const fallbackDescription = String(item.description || '');
                  const haystack = `${String(doc.description || '')}\n${fallbackDescription}`.toLowerCase();
                  const resolvedPackNameFromText = String(
                    (packs || []).find((p: any) => {
                      const n = String(p?.name || '').toLowerCase();
                      return n && haystack.includes(n);
                    })?.name || ''
                  );

                  const finalDesignation =
                    resolvedPackNameFromField ||
                    resolvedPackNameFromId ||
                    resolvedPackNameFromText ||
                    fallbackDescription;

                  return cleanHTML(String(finalDesignation || ''));
                })()}
              </Text>
              <Text style={[styles.tableCell, styles.tableCellQuote]}>{item.quantity}</Text>
              <Text style={[styles.tableCell, styles.tableCellQuote]}>{item.unitPrice}€</Text>
              <Text style={[styles.tableCell, styles.tableCellQuote]}>{item.total}€</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.totalSection, styles.totalSectionQuote]} wrap={false}>
        <View style={[styles.totalCard, styles.totalCardQuote]}>
          <View style={styles.totalRow}>
            <Text style={styles.label}>Sous-total:</Text>
            <Text style={styles.value}>{doc.subtotal}€</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.label}>TVA ({doc.tvaRate || 0}%):</Text>
            <Text style={styles.value}>{doc.tax}€</Text>
          </View>
          {(() => {
            const total = Number((doc as any).total || 0);
            const creditActive = !!((doc as any).taxCreditEnabled || (doc as any).hasTaxCredit);
            const creditAmount = creditActive ? total * 0.5 : 0;
            const toPay = creditActive ? total - creditAmount : total;

            return (
              <>
                <View style={[styles.totalRow, styles.grandTotalBrand]}>
                  <Text style={styles.labelBrand}>Total:</Text>
                  <Text>{total}€</Text>
                </View>
                {creditActive ? (
                  <>
                    <View style={styles.totalRow}>
                      <Text style={styles.label}>Crédit d'impôt (50%):</Text>
                      <Text style={styles.value}>-{creditAmount.toFixed(2)}€</Text>
                    </View>
                    <View style={[styles.totalRow, styles.grandTotalBrand]}>
                      <Text style={styles.labelBrand}>Reste à charge:</Text>
                      <Text>{toPay.toFixed(2)}€</Text>
                    </View>
                  </>
                ) : null}
              </>
            );
          })()}
        </View>
      </View>

      <View style={[styles.signatureSection, styles.signatureSectionQuote]} wrap>
        <Text style={styles.sectionTitleBrand}>Signatures</Text>
        <View style={[styles.signatureRow, styles.signatureRowQuote]}>
          <View style={[styles.signatureBoxCard, styles.signatureBoxCardQuote]}>
            <Text style={[styles.signatureText, styles.signatureTextQuote]}>Signature Presta Services Antilles</Text>
            {(() => {
              // IMPORTANT: si une source échoue silencieusement, react-pdf ne déclenche pas de fallback.
              // On privilégie donc une source "URL bundlée" (asset) avant la base64.
              const primary =
                getAnyImageSrc((doc as any)?.companyStamp) ||
                getAnyImageSrc(COMPANY_STAMP_LOCAL_SRC) ||
                getAnyImageSrc(STAMP_SIGNATURE_BASE64);
              console.log('Company signature result:', primary ? 'found' : 'not found');
              if (primary) {
                return <Image src={primary} style={[styles.companyStampImage, styles.companyStampImageQuote]} />;
              }
              return (
                <View style={{width: 100, height: 50, borderWidth: 1, borderColor: '#ccc', borderStyle: 'solid', alignItems: 'center', justifyContent: 'center', marginTop: 5}}>
                  <Text style={{fontSize: 8, color: '#999'}}>Signature entreprise</Text>
                </View>
              );
            })()}
            <Text style={styles.value}>Presta Services Antilles</Text>
          </View>

          <View style={[styles.signatureBoxCard, styles.signatureBoxCardQuote]}>
            <Text style={[styles.signatureText, styles.signatureTextQuote]}>Signature Client</Text>
            {(() => {
              const clientSig = getSignatureImage(doc.clientSignature || doc.signatureData || doc.clientSignatureUrl);
              console.log('Client signature result:', clientSig ? 'found' : 'not found');
              if (clientSig) {
                return <Image src={clientSig} style={[styles.signatureImage, styles.signatureImageQuote]} />;
              }
              return (
                <View style={{width: 120, height: 60, borderWidth: 1, borderColor: '#ccc', borderStyle: 'solid', alignItems: 'center', justifyContent: 'center', marginTop: 5}}>
                  <Text style={{fontSize: 8, color: '#999'}}>Signature client</Text>
                </View>
              );
            })()}
            <Text style={[styles.value, styles.signatureMetaCenterQuote]}>{doc.clientName}</Text>
            {(doc.signatureDate || doc.signedAt || doc.date) ? (
              <Text style={[styles.signatureCaption, styles.signatureCaptionQuote]}>
                Date de signature: {formatPDFDate(doc.signatureDate || doc.signedAt || doc.date)}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      <View style={[styles.footer, styles.footerQuote]} fixed>
        <Text>Presta Services Antilles - SIRET:  944 789 700 00019 - Email: : prestaservicesantilles.rh@gmail.com</Text>
        <Text>Téléphone: +596 0696 06 15 94 - www.prestaservicesantilles.com</Text>
      </View>
    </Page>
  </Document>
);

// Composant pour la facture
export const InvoicePDF = ({ doc, packs }: { doc: any, packs?: any[] }) => (
  <Document>
    <Page size="A4" style={styles.pageInvoice}>
      <View style={[styles.header, styles.headerInvoice]}>
        <View style={styles.headerInvoiceTopRow}>
          {(() => {
            const resolvedTvaRate = typeof doc.tvaRate === 'number' ? doc.tvaRate : (doc.tvaRate ? Number(doc.tvaRate) : 0);
            const logo = doc.logoBase64 || ((resolvedTvaRate || 0) === 0 ? LOGO_SAP_BASE64 : LOGO_BASE64);
            return logo && logo.startsWith('data:image/') ? (
              <Image src={logo} style={styles.logoInvoice} />
            ) : (
              <View style={styles.logoPlaceholderInvoice}>
                <Text style={[styles.placeholderText, styles.placeholderTextInvoice]}>LOGO</Text>
              </View>
            );
          })()}
          <View style={styles.headerInvoiceInfoBlock}>
            <Text style={[styles.title, styles.titleInvoice]}>FACTURE</Text>
            <Text style={[styles.subtitle, styles.subtitleInvoice]}>
              Presta Services Antilles - SIRET: 944 789 700 00019{"\n"}
              Email : prestaservicesantilles.rh@gmail.com
            </Text>
            <Text style={[styles.subtitle, styles.subtitleInvoice]}>Téléphone: +596 0696 06 15 94 - www.prestaservicesantilles.com</Text>
          </View>
        </View>
      </View>

      <View style={[styles.section, styles.sectionInvoice]}>
        <View style={styles.twoColRow}>
          <View style={styles.col48}>
            <Text style={[styles.sectionTitleBrand, styles.sectionTitleBrandInvoice]}>Informations Client</Text>
            <View style={[styles.card, styles.cardInvoice]}>
              <View style={[styles.row, styles.rowInvoice]}>
                <Text style={styles.label}>Nom:</Text>
                <Text style={styles.value}>{doc.clientName}</Text>
              </View>
              <View style={[styles.row, styles.rowInvoice]}>
                <Text style={styles.label}>Email:</Text>
                <Text style={styles.value}>{doc.clientEmail}</Text>
              </View>
              <View style={[styles.row, styles.rowInvoice]}>
                <Text style={styles.label}>Téléphone:</Text>
                <Text style={styles.value}>{doc.clientPhone}</Text>
              </View>
            </View>
          </View>

          <View style={styles.col48}>
            <Text style={[styles.sectionTitleBrand, styles.sectionTitleBrandInvoice]}>Informations Facture</Text>
            <View style={[styles.card, styles.cardTint, styles.cardInvoice]}>
              <View style={[styles.row, styles.rowInvoice]}>
                <Text style={styles.labelBrand}>Numéro:</Text>
                <Text style={styles.valueDark}>{doc.ref}</Text>
              </View>
              <View style={[styles.row, styles.rowInvoice]}>
                <Text style={styles.labelBrand}>Émission:</Text>
                <Text style={styles.valueDark}>{formatPDFDate(doc.date)}</Text>
              </View>
              <View style={[styles.row, styles.rowInvoice]}>
                <Text style={styles.labelBrand}>Échéance:</Text>
                <Text style={styles.valueDark}>{formatPDFDate(doc.dueDate)}</Text>
              </View>
              <View style={[styles.row, styles.rowInvoice]}>
                <Text style={styles.labelBrand}>Statut:</Text>
                <View style={[styles.statusBadge, styles.statusBadgeInvoice, doc.paid ? styles.paidBadge : styles.pendingBadge]}>
                  <Text>{doc.paid ? 'PAYÉE' : 'EN ATTENTE'}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>

      {(() => {
        const resolvedPackId = doc.packId;
        const resolvedPackName = doc.packName || (resolvedPackId ? (packs || []).find((p: any) => p.id === resolvedPackId)?.name : '') || '';
        const slots = Array.isArray(doc.slotsData) ? doc.slotsData : [];
        if (!resolvedPackName && slots.length === 0) return null;

        const totalHours = slots.reduce((acc: number, s: any) => acc + (Number(s?.duration) || 0), 0);

        return (
          <View style={[styles.section, styles.sectionInvoice]}>
            <Text style={[styles.sectionTitleBrand, styles.sectionTitleBrandInvoice]}>Informations Pack</Text>
            <View style={[styles.card, styles.cardTint, styles.cardInvoice]}>
              {resolvedPackName ? (
                <View style={[styles.row, styles.rowInvoice]}>
                  <Text style={styles.labelBrand}>Nom du pack:</Text>
                  <Text style={styles.valueDark}>{cleanHTML(String(resolvedPackName || ''))}</Text>
                </View>
              ) : null}

              {slots.length > 0 ? (
                <>
                  <View style={[styles.row, styles.rowInvoice]}>
                    <Text style={styles.labelBrand}>Nombre de jours:</Text>
                    <Text style={styles.valueDark}>{slots.length} jour(s)</Text>
                  </View>
                  <View style={[styles.row, styles.rowInvoice]}>
                    <Text style={styles.labelBrand}>Total d'heures:</Text>
                    <Text style={styles.valueDark}>{totalHours}h</Text>
                  </View>
                  <View style={[styles.list, styles.listInvoice]}>
                    {slots.map((slot: any, index: number) => (
                      <View key={index} style={[styles.listItemRow, styles.listItemRowInvoice]}>
                        <Text style={[styles.listBullet, styles.listBulletInvoice]}>{index + 1}.</Text>
                        <Text style={[styles.listText, styles.listTextInvoice]}>
                          {cleanHTML(String(slot?.date || ''))} - {cleanHTML(String(slot?.startTime || ''))} à {cleanHTML(String(slot?.endTime || ''))}
                          {slot?.duration ? ` (${cleanHTML(String(slot.duration))}h)` : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          </View>
        );
      })()}

      <View style={[styles.section, styles.sectionInvoice]}>
        <Text style={[styles.sectionTitleBrand, styles.sectionTitleBrandInvoice]}>Détails de la Facture</Text>
        <View style={[styles.table, styles.tableInvoice]}>
          <View style={[styles.tableRow, styles.tableHeader, styles.tableHeaderBrand]}>
            <Text style={[styles.tableCell, styles.descriptionCell, styles.tableCellInvoice, styles.descriptionCellInvoice]}>Description</Text>
            <Text style={[styles.tableCell, styles.tableCellInvoice]}>Qté</Text>
            <Text style={[styles.tableCell, styles.tableCellInvoice]}>PU</Text>
            <Text style={[styles.tableCell, styles.tableCellInvoice]}>Total</Text>
          </View>
          {doc.items?.map((item: any, index: number) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.descriptionCell, styles.tableCellInvoice, styles.descriptionCellInvoice]}>{cleanHTML(item.description || '')}</Text>
              <Text style={[styles.tableCell, styles.tableCellInvoice]}>{item.quantity}</Text>
              <Text style={[styles.tableCell, styles.tableCellInvoice]}>{item.unitPrice}€</Text>
              <Text style={[styles.tableCell, styles.tableCellInvoice]}>{item.total}€</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.totalSection, styles.totalSectionInvoice]}>
        {(() => {
          const resolvedTvaRate = typeof doc.tvaRate === 'number' ? doc.tvaRate : (doc.tvaRate ? Number(doc.tvaRate) : 0);
          const total = Number((doc as any).total || 0);
          const creditActive = !!((doc as any).taxCreditEnabled || (doc as any).hasTaxCredit);
          const creditAmount = creditActive ? total * 0.5 : 0;
          const toPay = creditActive ? total - creditAmount : total;
          return (
            <View style={[styles.totalCard, styles.totalCardInvoice]}>
              <View style={[styles.totalRow, styles.totalRowInvoice, styles.rowInvoice]}>
                <Text style={styles.label}>Sous-total:</Text>
                <Text style={styles.value}>{doc.subtotal}€</Text>
              </View>
              <View style={[styles.totalRow, styles.totalRowInvoice, styles.rowInvoice]}>
                <Text style={styles.label}>TVA ({resolvedTvaRate || 0}%):</Text>
                <Text style={styles.value}>{doc.tax}€</Text>
              </View>
              <View style={[styles.totalRow, styles.grandTotalBrand]}>
                <Text style={styles.labelBrand}>Total:</Text>
                <Text>{total}€</Text>
              </View>
              {creditActive ? (
                <>
                  <View style={[styles.totalRow, styles.totalRowInvoice, styles.rowInvoice]}>
                    <Text style={styles.label}>Crédit d'impôt (50%):</Text>
                    <Text style={styles.value}>-{creditAmount.toFixed(2)}€</Text>
                  </View>
                  <View style={[styles.totalRow, styles.grandTotalBrand]}>
                    <Text style={styles.labelBrand}>Total à payer:</Text>
                    <Text>{toPay.toFixed(2)}€</Text>
                  </View>
                </>
              ) : (
                <View style={[styles.totalRow, styles.grandTotalBrand]}>
                  <Text style={styles.labelBrand}>Total à payer:</Text>
                  <Text>{total}€</Text>
                </View>
              )}
            </View>
          );
        })()}
      </View>

      {doc.paymentInfo && (
        <View style={[styles.section, styles.sectionInvoice]}>
          <Text style={styles.sectionTitleInvoice}>Informations de Paiement</Text>
          <Text style={styles.value}>{cleanHTML(doc.paymentInfo || '')}</Text>
        </View>
      )}

      <View style={[styles.footer, styles.footerInvoice]} fixed>
        <Text>Presta Services Antilles - SIRET:  944 789 700 00019 - Email: : prestaservicesantilles.rh@gmail.com</Text>
        <Text>Téléphone: +596 0696 06 15 94 - www.prestaservicesantilles.com</Text>
      </View>
    </Page>
  </Document>
);

// Composant pour le contrat
export const ContractPDF = ({ doc, packs }: { doc: any, packs?: any[] }) => (
  <Document>
    <Page size="A4" style={[styles.page, styles.pageContract]}>
      <View style={[styles.header, styles.headerContract]}>
        {(() => {
          const resolvedTvaRate = typeof doc.tvaRate === 'number' ? doc.tvaRate : (doc.tvaRate ? Number(doc.tvaRate) : 0);
          const logo = doc.logoBase64 || ((resolvedTvaRate || 0) === 0 ? LOGO_SAP_BASE64 : LOGO_BASE64);
          return (
            <View style={styles.headerCard}>
              <View style={styles.headerTopRow}>
                {logo && logo.startsWith('data:image/') ? (
                  <Image src={logo} style={[styles.logo, styles.logoSmall]} />
                ) : (
                  <View style={[styles.logoPlaceholder, { width: 74, height: 74, marginBottom: 0 }]}>
                    <Text style={styles.placeholderText}>LOGO</Text>
                  </View>
                )}
                <View style={styles.headerTextBlock}>
                  <Text style={[styles.title, styles.titleBrand]}>CONTRAT DE SERVICES</Text>
                  <Text style={styles.subtitleSmall}>Contrat de services entre Presta Services Antilles et {doc.clientName}</Text>
                  <Text style={styles.subtitleSmall}>
                    Presta Services Antilles - SIRET: 944 789 700 00019{"\n"}
                    Email : prestaservicesantilles.rh@gmail.com
                  </Text>
                  <Text style={styles.subtitleSmall}>Téléphone: +596 0696 06 15 94 - www.prestaservicesantilles.com</Text>
                </View>
              </View>
            </View>
          );
        })()}
      </View>

      <View style={[styles.section, styles.sectionCompact]}>
        <Text style={styles.sectionTitleBrand}>Informations Client</Text>
        <View style={[styles.card, styles.cardTint]}>
          <View style={styles.rowTight}>
            <Text style={styles.labelBrand}>Nom:</Text>
            <Text style={styles.valueDark}>{doc.clientName}</Text>
          </View>
          {doc.clientEmail ? (
            <View style={styles.rowTight}>
              <Text style={styles.labelBrand}>Email:</Text>
              <Text style={styles.valueDark}>{doc.clientEmail}</Text>
            </View>
          ) : null}
          {doc.clientPhone ? (
            <View style={styles.rowTight}>
              <Text style={styles.labelBrand}>Téléphone:</Text>
              <Text style={styles.valueDark}>{doc.clientPhone}</Text>
            </View>
          ) : null}
          <View style={styles.rowTight}>
            <Text style={styles.labelBrand}>Référence:</Text>
            <Text style={styles.valueDark}>{doc.ref}</Text>
          </View>
          <View style={styles.rowTight}>
            <Text style={styles.labelBrand}>Date de signature:</Text>
            <Text style={styles.valueDark}>{formatPDFDate(doc.signatureDate || doc.signedAt || doc.date)}</Text>
          </View>
          <View style={styles.rowTight}>
            <Text style={styles.labelBrand}>Durée:</Text>
            <Text style={styles.valueDark}>{doc.duration}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.section, styles.sectionCompact]}>
        <Text style={styles.sectionTitle}>Parties Contractantes</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Client:</Text>
          <Text style={styles.value}>{doc.clientName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Prestataire:</Text>
          <Text style={styles.value}>Presta Services Antilles</Text>
        </View>
      </View>

      <View style={[styles.section, styles.sectionCompact]}>
        <Text style={styles.sectionTitle}>Objet du Contrat</Text>
        <Text style={styles.value}>{cleanHTML(doc.object || '')}</Text>
      </View>

      {typeof doc.content === 'string' && doc.content.trim() ? <View break={false} /> : null}

      {typeof doc.content === 'string' && doc.content.trim() ? (
        <View style={[styles.section, styles.sectionCompact]}>
          <Text style={styles.sectionTitle}>Contenu du Contrat</Text>
          <View style={[styles.contractContentCard, styles.contractContentCardContract]}>
            {renderContractContent(doc.content)}
          </View>
        </View>
      ) : null}

      <View style={[styles.section, styles.sectionCompact]}>
        <Text style={styles.sectionTitle}>Conditions Financières</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Montant total:</Text>
          <Text style={styles.value}>{doc.total}€</Text>
        </View>
        {(() => {
          const total = Number((doc as any).total || 0);
          const creditActive = !!((doc as any).taxCreditEnabled || (doc as any).hasTaxCredit);
          if (!creditActive) return null;
          const creditAmount = total * 0.5;
          const toPay = total - creditAmount;
          return (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>Crédit d'impôt (50%):</Text>
                <Text style={styles.value}>-{creditAmount.toFixed(2)}€</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Reste à charge:</Text>
                <Text style={styles.value}>{toPay.toFixed(2)}€</Text>
              </View>
            </>
          );
        })()}
        <View style={styles.row}>
          <Text style={styles.label}>Modalités de paiement:</Text>
          <Text style={styles.value}>{cleanHTML(doc.paymentTerms || '')}</Text>
        </View>
      </View>

      <View style={[styles.signatureSection, styles.signatureSectionContract]} wrap={false}>
        <Text style={styles.sectionTitleBrand}>Signatures</Text>
        <View style={[styles.signatureRow, styles.signatureRowContract]}>
          <View style={[styles.signatureBoxCard, styles.signatureBoxCardContract]}>
            <Text style={[styles.signatureText, styles.signatureTextContract]}>Signature Client</Text>
            {(() => {
              const clientSig = getSignatureImage(doc.clientSignature || doc.signatureData || doc.clientSignatureUrl);
              console.log('Contract client signature result:', clientSig ? 'found' : 'not found');
              if (clientSig) {
                return <Image src={clientSig} style={styles.signatureImage} />;
              } else {
                return (
                  <View style={{width: 120, height: 60, borderWidth: 1, borderColor: '#ccc', borderStyle: 'solid', alignItems: 'center', justifyContent: 'center', marginTop: 5}}>
                    <Text style={{fontSize: 8, color: '#999'}}>Signature client</Text>
                  </View>
                );
              }
            })()}
            <Text style={styles.value}>{doc.clientName}</Text>
            {(doc.signatureDate || doc.signedAt || doc.date) ? (
              <Text style={styles.signatureCaption}>
                Date de signature: {formatPDFDate(doc.signatureDate || doc.signedAt || doc.date)}
              </Text>
            ) : null}
          </View>
          <View style={[styles.signatureBoxCard, styles.signatureBoxCardContract]} minPresenceAhead={220}>
            <Text style={[styles.signatureText, styles.signatureTextContract]}>Signature Presta Services Antilles</Text>
            {(() => {
              const primary = COMPANY_STAMP_LOCAL_SRC;
              console.log('Company signature result:', primary ? 'found' : 'not found');
              if (primary) {
                return <Image src={primary} style={styles.companyStampImage} />;
              }
              return (
                <View style={{width: 100, height: 50, borderWidth: 1, borderColor: '#ccc', borderStyle: 'solid', alignItems: 'center', justifyContent: 'center', marginTop: 5}}>
                  <Text style={{fontSize: 8, color: '#999'}}>Signature entreprise</Text>
                </View>
              );
            })()}
            <Text style={styles.value}>Presta Services Antilles</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer} fixed>
        <Text>Presta Services Antilles - SIRET: 944 789 700 00019 - Email : prestaservicesantilles.rh@gmail.com</Text>
        <Text>Téléphone: +596 0696 06 15 94 - www.prestaservicesantilles.com</Text>
      </View>
    </Page>
  </Document>
);
