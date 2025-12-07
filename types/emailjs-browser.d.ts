declare module '@emailjs/browser' {
  export function send(
    serviceID: string,
    templateID: string,
    templateParams?: Record<string, any>,
    publicKey?: string
  ): Promise<{ status: number; text: string }>;
}
