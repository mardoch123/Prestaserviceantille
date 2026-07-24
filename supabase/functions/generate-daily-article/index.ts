import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

declare const Deno: { env: { get(key: string): string | undefined } };

type ArticleSettings = {
  enabled: boolean;
  auto_publish: boolean;
  topic: string | null;
  audience: string;
  language: 'fr' | 'en';
  tone: string;
  min_words: number;
  max_words: number;
  ai_model: string;
};

type GeneratedArticle = {
  title: string;
  excerpt: string;
  content_markdown: string;
  seo_title?: string;
  seo_description?: string;
  keywords?: string[];
};

const jsonHeaders = { 'Content-Type': 'application/json' };

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function toSlug(value: string, date: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return `${normalized || 'article'}-${date.replaceAll('-', '')}`;
}

function extractJson(text: string): GeneratedArticle {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  const value = JSON.parse(cleaned) as GeneratedArticle;
  if (!value.title?.trim() || !value.excerpt?.trim() || !value.content_markdown?.trim()) {
    throw new Error('The AI response does not contain the required article fields.');
  }
  return {
    title: value.title.trim(),
    excerpt: value.excerpt.trim(),
    content_markdown: value.content_markdown.trim(),
    seo_title: value.seo_title?.trim() || undefined,
    seo_description: value.seo_description?.trim() || undefined,
    keywords: Array.isArray(value.keywords)
      ? value.keywords.map((keyword) => String(keyword).trim()).filter(Boolean).slice(0, 12)
      : [],
  };
}

function buildPrompt(settings: ArticleSettings): string {
  const language = settings.language === 'en' ? 'English' : 'French';
  return `You are an expert content writer. Return only valid JSON, with no Markdown fence.

Write one original SEO article in ${language}.
Topic: ${settings.topic}
Target audience: ${settings.audience}
Tone: ${settings.tone}
Target length: between ${settings.min_words} and ${settings.max_words} words.

Requirements:
- Be factually cautious: do not invent prices, laws, testimonials, certifications, or company claims.
- Use useful headings in Markdown and practical advice.
- Do not include HTML, a call to action containing a URL, or a publication date.
- Produce an informative article suitable for later editorial review.

Return this exact JSON shape:
{
  "title": "string",
  "excerpt": "string, 120 to 220 characters",
  "content_markdown": "string",
  "seo_title": "string, maximum 60 characters",
  "seo_description": "string, maximum 155 characters",
  "keywords": ["string"]
}`;
}

async function generateWithDeepSeek(settings: ArticleSettings): Promise<GeneratedArticle> {
  const apiKey = Deno.env.get('DEEPSEEK_API_KEY')?.trim();
  if (!apiKey) throw new Error('Missing required environment variable: DEEPSEEK_API_KEY');

  const model = settings.ai_model?.toLowerCase().includes('deepseek') ? settings.ai_model : 'deepseek-chat';
  const endpoint = 'https://api.deepseek.com/chat/completions';

  const result = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert content writer for websites and blogs. Respond strictly with valid JSON.',
        },
        {
          role: 'user',
          content: buildPrompt(settings),
        },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!result.ok) {
    const errText = await result.text();
    throw new Error(`DeepSeek generation failed with HTTP ${result.status}: ${errText}`);
  }

  const payload = await result.json();
  const text = payload?.choices?.[0]?.message?.content;
  if (!text) throw new Error('DeepSeek returned an empty response.');
  return extractJson(text);
}

async function generateWithGemini(settings: ArticleSettings): Promise<GeneratedArticle> {
  const apiKey = requiredEnv('GEMINI_API_KEY');
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.ai_model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const result = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildPrompt(settings) }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!result.ok) {
    throw new Error(`Gemini generation failed with HTTP ${result.status}.`);
  }

  const payload = await result.json();
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || '')
    .join('');
  if (!text) throw new Error('Gemini returned an empty response.');
  return extractJson(text);
}

async function generateArticle(settings: ArticleSettings): Promise<GeneratedArticle> {
  const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY')?.trim();
  const geminiKey = Deno.env.get('GEMINI_API_KEY')?.trim();

  if (deepseekKey || settings.ai_model?.toLowerCase().includes('deepseek')) {
    return await generateWithDeepSeek(settings);
  } else if (geminiKey) {
    return await generateWithGemini(settings);
  } else {
    throw new Error('No AI API key found. Please set DEEPSEEK_API_KEY or GEMINI_API_KEY in environment secrets.');
  }
}

serve(async (request: Request) => {
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405);

  try {
    const cronSecret = requiredEnv('ARTICLE_AUTOMATION_CRON_SECRET');
    if (request.headers.get('x-article-automation-secret') !== cronSecret) {
      return response({ error: 'Unauthorized' }, 401);
    }

    const supabase = createClient(
      requiredEnv('SUPABASE_URL'),
      requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: settings, error: settingsError } = await supabase
      .from('article_generation_settings')
      .select('*')
      .eq('id', true)
      .single<ArticleSettings>();
    if (settingsError) throw settingsError;

    if (!settings.enabled || !settings.topic?.trim()) {
      return response({ ok: true, skipped: 'automation_disabled_or_unconfigured' });
    }

    const scheduledFor = new Date().toISOString().slice(0, 10);
    const { data: run, error: claimError } = await supabase
      .rpc('claim_daily_article_generation', { p_scheduled_for: scheduledFor })
      .maybeSingle();
    if (claimError) throw claimError;
    if (!run) return response({ ok: true, skipped: 'already_running_or_generated', scheduledFor });

    try {
      const article = await generateArticle(settings);
      const { data: savedArticle, error: insertError } = await supabase
        .from('articles')
        .insert({
          slug: toSlug(article.title, scheduledFor),
          title: article.title,
          excerpt: article.excerpt,
          content_markdown: article.content_markdown,
          seo_title: article.seo_title || null,
          seo_description: article.seo_description || null,
          keywords: article.keywords || [],
          generated_date: scheduledFor,
          status: settings.auto_publish ? 'published' : 'draft',
          published_at: settings.auto_publish ? new Date().toISOString() : null,
        })
        .select('id, status, slug')
        .single();
      if (insertError) throw insertError;

      const { error: completedError } = await supabase
        .from('article_generation_runs')
        .update({ status: 'succeeded', article_id: savedArticle.id, completed_at: new Date().toISOString() })
        .eq('id', run.id);
      if (completedError) throw completedError;

      return response({ ok: true, scheduledFor, article: savedArticle });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 1000) : 'Unknown generation error';
      await supabase
        .from('article_generation_runs')
        .update({ status: 'failed', error_message: message, completed_at: new Date().toISOString() })
        .eq('id', run.id);
      throw error;
    }
  } catch (error) {
    console.error('Daily article generation failed:', error instanceof Error ? error.message : error);
    return response({ ok: false, error: 'Article generation failed. Check Edge Function logs.' }, 500);
  }
});
