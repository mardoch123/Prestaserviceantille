export type MessageProvider = 'smsmode' | 'wa_me' | 'custom';

export interface ApiConfig {
  provider: MessageProvider;
  apiKey?: string;
  baseUrl?: string;
  customHeaders?: Record<string, string>;
}

export interface ProviderOption {
  id: MessageProvider;
  name: string;
  description: string;
  needsApiKey: boolean;
  baseUrl: string;
}

export const MESSAGE_PROVIDERS: ProviderOption[] = [
  {
    id: 'wa_me',
    name: 'WhatsApp Web (wa.me)',
    description: 'Ouvrir WhatsApp Web avec message pré-rempli (gratuit)',
    needsApiKey: false,
    baseUrl: 'https://wa.me'
  },
  {
    id: 'smsmode',
    name: 'SMSMode',
    description: 'API SMSMode pour WhatsApp Business',
    needsApiKey: true,
    baseUrl: 'https://api.smsmode.com'
  },
  {
    id: 'custom',
    name: 'API Personnalisée',
    description: 'Configurer votre propre fournisseur d\'API',
    needsApiKey: true,
    baseUrl: ''
  }
];

const DEFAULT_CONFIG: ApiConfig = {
  provider: 'smsmode'
};

let currentConfig: ApiConfig = { ...DEFAULT_CONFIG };

export const getApiConfig = (): ApiConfig => currentConfig;

export const setApiConfig = (config: Partial<ApiConfig>): void => {
  currentConfig = { ...currentConfig, ...config };
};

export const resetApiConfig = (): void => {
  currentConfig = { ...DEFAULT_CONFIG };
};

export const getProviderById = (id: MessageProvider): ProviderOption | undefined => {
  return MESSAGE_PROVIDERS.find(p => p.id === id);
};
