import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { LOGO_BASE64, LOGO_SAP_BASE64, SIGNATURE_BASE64, STAMP_SIGNATURE_BASE64 } from '../src/assets/images';
import { formatPDFDate } from '../src/utils/dayjsMartinique';

// Fonction pour convertir une URL en base64 ou retourner la valeur base64 existante
const getSignatureImage = (signature: string | undefined): string | null => {
  if (!signature) return null;
  
  // Si c'est déjà en base64, le retourner directement
  if (signature.startsWith('data:image/')) {
    console.log('Using base64 signature');
    return signature;
  }
  
  // Si c'est une URL, utiliser les constantes base64 disponibles
  if (signature.includes('prestaservicesantilles.com/signature.png')) {
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

// Enregistrement de polices personnalisées
Font.register({
  family: 'Helvetica',
  src: 'https://fonts.googleapis.com/css2?family=Helvetica:wght@300;400;700&display=swap'
});

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 12,
    padding: 40,
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 30,
    borderBottom: 2,
    borderBottomColor: '#1a1a1a',
    borderBottomStyle: 'solid',
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    marginBottom: 5,
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 20,
    alignSelf: 'center',
  },
  logoPlaceholder: {
    width: 200,
    height: 200,
    marginBottom: 20,
    alignSelf: 'center',
    border: 1,
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  label: {
    fontWeight: 'bold',
    color: '#333',
  },
  boldInlineLabel: {
    fontWeight: 'bold',
    color: '#333',
  },
  value: {
    color: '#666',
  },
  table: {
    width: '100%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 20,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: 1,
    borderBottomColor: '#ddd',
    borderBottomStyle: 'solid',
  },
  tableHeader: {
    backgroundColor: '#f8f9fa',
    fontWeight: 'bold',
  },
  tableCell: {
    padding: 8,
    flex: 1,
  },
  descriptionCell: {
    flex: 3,
  },
  totalSection: {
    marginTop: 20,
    borderTop: 1,
    borderTopColor: '#ddd',
    borderTopStyle: 'solid',
    paddingTop: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  grandTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  signatureSection: {
    marginTop: 50,
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
  },
  signatureBox: {
    width: '45%',
    borderTop: 1,
    borderTopColor: '#333',
    borderTopStyle: 'solid',
    paddingTop: 5,
  },
  signatureText: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    borderTop: 1,
    borderTopColor: '#ddd',
    borderTopStyle: 'solid',
    paddingTop: 10,
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
  pendingBadge: {
    backgroundColor: '#ffc107',
    color: '#212529',
  },
  paidBadge: {
    backgroundColor: '#dc3545',
    color: 'white',
  },
  htmlImage: {
    width: 120,
    height: 60,
  },
  signatureImage: {
    width: 100,
    height: 50,
    marginBottom: 5,
  },
  companyStampImage: {
    width: 120,
    height: 60,
    marginBottom: 5,
  },
});

// Composant pour le devis signé
export const SignedQuotePDF = ({ doc, packs }: { doc: any, packs?: any[] }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        {(() => {
          try {
            const resolvedTvaRate = typeof doc.tvaRate === 'number' ? doc.tvaRate : (doc.tvaRate ? Number(doc.tvaRate) : 0);
            const logo = doc.logoBase64 || ((resolvedTvaRate || 0) === 0 ? LOGO_SAP_BASE64 : LOGO_BASE64);
            console.log('Logo selection - TVA Rate:', doc.tvaRate, 'Logo type:', (doc.tvaRate || 0) === 0 ? 'SAP' : 'Normal');
            console.log('Logo data length:', logo ? logo.length : 'undefined');
            console.log('Logo starts with data:image:', logo ? logo.startsWith('data:image/') : false);
            
            if (logo && logo.startsWith('data:image/')) {
              return <Image src={logo} style={styles.logo} />;
            } else {
              console.log('Using placeholder logo');
              return (
                <View style={styles.logoPlaceholder}>
                  <Text style={styles.placeholderText}>LOGO</Text>
                </View>
              );
            }
          } catch (error) {
            console.error('Error rendering logo:', error);
            return (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.placeholderText}>LOGO</Text>
              </View>
            );
          }
        })()}
        <Text style={styles.title}>{doc.status === 'signed' ? 'DEVIS SIGNÉ' : 'DEVIS'}</Text>
        <Text style={styles.subtitle}>Presta Services Antilles - SIRET: 944 789 700 00019 - Email: : prestaservicesantilles.rh@gmail.com</Text>
        <Text style={styles.subtitle}>Téléphone: +596 696 06 15 94 - www.prestaservicesantilles.com</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.label}>Référence:</Text>
          <Text style={styles.value}>{doc.ref}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Date:</Text>
          <Text style={styles.value}>
            {formatPDFDate(doc.date)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Statut:</Text>
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informations Client</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Nom:</Text>
          <Text style={styles.value}>{doc.clientName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Email:</Text>
          <Text style={styles.value}>{doc.clientEmail}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Téléphone:</Text>
          <Text style={styles.value}>{doc.clientPhone}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Détails du Devis</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.tableCell}>Description</Text>
            <Text style={styles.tableCell}>Quantité</Text>
            <Text style={styles.tableCell}>Prix Unit.</Text>
            <Text style={styles.tableCell}>Total</Text>
          </View>
          {doc.items?.map((item: any, index: number) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.descriptionCell]}>
                {cleanHTML(item.description || '')}
                {item.location ? (
                  <>
                    {'\n'}
                    <Text style={styles.boldInlineLabel}>Lieu:</Text> {cleanHTML(item.location || '')}
                  </>
                ) : null}
              </Text>
              <Text style={styles.tableCell}>{item.quantity}</Text>
              <Text style={styles.tableCell}>{item.unitPrice}€</Text>
              <Text style={styles.tableCell}>{item.total}€</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.totalSection}>
        <View style={styles.totalRow}>
          <Text style={styles.label}>Sous-total:</Text>
          <Text style={styles.value}>{doc.subtotal}€</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.label}>TVA ({doc.tvaRate || 0}%):</Text>
          <Text style={styles.value}>{doc.tax}€</Text>
        </View>
        <View style={[styles.totalRow, styles.grandTotal]}>
          <Text style={styles.label}>Total:</Text>
          <Text>{doc.total}€</Text>
        </View>
      </View>

      {doc.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.value}>{cleanHTML(doc.notes || '')}</Text>
        </View>
      )}

      <View style={styles.signatureSection}>
        <Text style={styles.sectionTitle}>Signatures</Text>
        <View style={styles.signatureRow}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureText}>Signature PrestaService</Text>
            {(() => {
              const companySig = getSignatureImage(doc.companySignature || doc.companyStamp || doc.adminSignature || 'https://prestaservicesantilles.com/signature.png');
              console.log('Company signature result:', companySig ? 'found' : 'not found');
              if (companySig) {
                return <Image src={companySig} style={styles.companyStampImage} />;
              } else {
                return (
                  <View style={{width: 100, height: 50, border: '1pt solid #ccc', alignItems: 'center', justifyContent: 'center', marginTop: 5}}>
                    <Text style={{fontSize: 8, color: '#999'}}>Signature entreprise</Text>
                  </View>
                );
              }
            })()}
            <Text style={styles.value}>Presta Services Antilles</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureText}>Signature Client</Text>
            {(() => {
              const clientSig = getSignatureImage(doc.clientSignature || doc.clientSignatureUrl);
              console.log('Client signature result:', clientSig ? 'found' : 'not found');
              if (clientSig) {
                return <Image src={clientSig} style={styles.signatureImage} />;
              } else {
                return (
                  <View style={{width: 120, height: 60, border: '1pt solid #ccc', alignItems: 'center', justifyContent: 'center', marginTop: 5}}>
                    <Text style={{fontSize: 8, color: '#999'}}>Signature client</Text>
                  </View>
                );
              }
            })()}
            <Text style={styles.value}>{doc.clientName}</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Text>Presta Services Antilles - SIRET:  944 789 700 00019 - Email: : prestaservicesantilles.rh@gmail.com</Text>
        <Text>Téléphone: +596 0696 06 15 94 - www.prestaservicesantilles.com</Text>
      </View>
    </Page>
  </Document>
);

// Composant pour la facture
export const InvoicePDF = ({ doc, packs }: { doc: any, packs?: any[] }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        {(() => {
          const resolvedTvaRate = typeof doc.tvaRate === 'number' ? doc.tvaRate : (doc.tvaRate ? Number(doc.tvaRate) : 0);
          const logo = doc.logoBase64 || ((resolvedTvaRate || 0) === 0 ? LOGO_SAP_BASE64 : LOGO_BASE64);
          return logo && logo.startsWith('data:image/') ? (
            <Image src={logo} style={styles.logo} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.placeholderText}>LOGO</Text>
            </View>
          );
        })()}
        <Text style={styles.title}>FACTURE</Text>
        <Text style={styles.subtitle}>Presta Services Antilles - SIRET: 944 789 700 00019 - Email: : prestaservicesantilles.rh@gmail.com</Text>
        <Text style={styles.subtitle}>Téléphone: +596 696 06 15 94 - www.prestaservicesantilles.com</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.label}>Numéro Facture:</Text>
          <Text style={styles.value}>{doc.ref}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Date d'émission:</Text>
          <Text style={styles.value}>
            {formatPDFDate(doc.date)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Date d'échéance:</Text>
          <Text style={styles.value}>
            {formatPDFDate(doc.dueDate)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Statut:</Text>
          <View style={[styles.statusBadge, doc.paid ? styles.paidBadge : styles.pendingBadge]}>
            <Text>{doc.paid ? 'PAYÉE' : 'EN ATTENTE DE PAIEMENT'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informations Client</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Nom:</Text>
          <Text style={styles.value}>{doc.clientName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Email:</Text>
          <Text style={styles.value}>{doc.clientEmail}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Téléphone:</Text>
          <Text style={styles.value}>{doc.clientPhone}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Détails de la Facture</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.tableCell}>Description</Text>
            <Text style={styles.tableCell}>Quantité</Text>
            <Text style={styles.tableCell}>Prix Unit.</Text>
            <Text style={styles.tableCell}>Total</Text>
          </View>
          {doc.items?.map((item: any, index: number) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.descriptionCell]}>{cleanHTML(item.description || '')}</Text>
              <Text style={styles.tableCell}>{item.quantity}</Text>
              <Text style={styles.tableCell}>{item.unitPrice}€</Text>
              <Text style={styles.tableCell}>{item.total}€</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.totalSection}>
        <View style={styles.totalRow}>
          <Text style={styles.label}>Sous-total:</Text>
          <Text style={styles.value}>{doc.subtotal}€</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.label}>TVA (20%):</Text>
          <Text style={styles.value}>{doc.tax}€</Text>
        </View>
        <View style={[styles.totalRow, styles.grandTotal]}>
          <Text style={styles.label}>Total à payer:</Text>
          <Text>{doc.total}€</Text>
        </View>
      </View>

      {doc.paymentInfo && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations de Paiement</Text>
          <Text style={styles.value}>{cleanHTML(doc.paymentInfo || '')}</Text>
        </View>
      )}

      <View style={styles.footer}>
        <Text>Presta Services Antilles - SIRET:  944 789 700 00019 - Email: : prestaservicesantilles.rh@gmail.com</Text>
        <Text>Téléphone: +596 0696 06 15 94 - www.prestaservicesantilles.com</Text>
      </View>
    </Page>
  </Document>
);

// Composant pour le contrat
export const ContractPDF = ({ doc, packs }: { doc: any, packs?: any[] }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        {(() => {
          const resolvedTvaRate = typeof doc.tvaRate === 'number' ? doc.tvaRate : (doc.tvaRate ? Number(doc.tvaRate) : 0);
          const logo = doc.logoBase64 || ((resolvedTvaRate || 0) === 0 ? LOGO_SAP_BASE64 : LOGO_BASE64);
          return logo && logo.startsWith('data:image/') ? (
            <Image src={logo} style={styles.logo} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.placeholderText}>LOGO</Text>
            </View>
          );
        })()}
        <Text style={styles.title}>CONTRAT DE SERVICES</Text>
        <Text style={styles.subtitle}>Presta Services Antilles - SIRET: 944 789 700 00019 - Email: : prestaservicesantilles.rh@gmail.com</Text>
        <Text style={styles.subtitle}>Téléphone: +596 696 06 15 94 - www.prestaservicesantilles.com</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.label}>Référence:</Text>
          <Text style={styles.value}>{doc.ref}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Date de signature:</Text>
          <Text style={styles.value}>
            {formatPDFDate(doc.date)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Durée:</Text>
          <Text style={styles.value}>{doc.duration}</Text>
        </View>
      </View>

      <View style={styles.section}>
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Objet du Contrat</Text>
        <Text style={styles.value}>{cleanHTML(doc.object || '')}</Text>
      </View>

      {typeof doc.content === 'string' && doc.content.trim() ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contenu du Contrat</Text>
          <Text style={styles.value}>{formatContractText(doc.content)}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conditions Financières</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Montant total:</Text>
          <Text style={styles.value}>{doc.total}€</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Modalités de paiement:</Text>
          <Text style={styles.value}>{cleanHTML(doc.paymentTerms || '')}</Text>
        </View>
      </View>

      <View style={styles.signatureSection}>
        <Text style={styles.sectionTitle}>Signatures</Text>
        <View style={styles.signatureRow}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureText}>Signature Client</Text>
            {(() => {
              const clientSig = getSignatureImage(doc.clientSignature || doc.clientSignatureUrl);
              console.log('Contract client signature result:', clientSig ? 'found' : 'not found');
              if (clientSig) {
                return <Image src={clientSig} style={styles.signatureImage} />;
              } else {
                return (
                  <View style={{width: 100, height: 50, border: '1pt solid #ccc', alignItems: 'center', justifyContent: 'center', marginTop: 5}}>
                    <Text style={{fontSize: 8, color: '#999'}}>Signature manquante</Text>
                  </View>
                );
              }
            })()}
            <Text style={styles.value}>{doc.clientName}</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureText}>Signature PrestaService</Text>
            {(() => {
              const companySig = getSignatureImage(doc.companySignature || doc.companyStamp || doc.adminSignature || 'https://prestaservicesantilles.com/signature.png');
              console.log('Contract company signature result:', companySig ? 'found' : 'not found');
              if (companySig) {
                return <Image src={companySig} style={styles.companyStampImage} />;
              } else {
                return (
                  <View style={{width: 120, height: 60, border: '1pt solid #ccc', alignItems: 'center', justifyContent: 'center', marginTop: 5}}>
                    <Text style={{fontSize: 8, color: '#999'}}>Signature manquante</Text>
                  </View>
                );
              }
            })()}
            <Text style={styles.value}>Presta Services Antilles</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Text>Presta Services Antilles - SIRET: 944 789 700 00019 - Email: : prestaservicesantilles.rh@gmail.com</Text>
        <Text>Téléphone: +596 0696 06 15 94 - www.prestaservicesantilles.com</Text>
      </View>
    </Page>
  </Document>
);
