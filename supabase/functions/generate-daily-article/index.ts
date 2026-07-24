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

type QualityReport = {
  keyword_density_score: number; // Max 30
  structure_score: number;       // Max 25
  seo_meta_score: number;        // Max 25
  readability_score: number;     // Max 20
  feedback: string;
};

type GeneratedArticle = {
  title: string;
  excerpt: string;
  content_markdown: string;
  seo_title?: string;
  seo_description?: string;
  keywords?: string[];
  category?: string;
  image_url?: string;
  seo_score: number;
  quality_report: QualityReport;
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

const CATEGORY_IMAGES: Record<string, string> = {
  'Ménage & Repassage': 'https://images.pexels.com/photos/4099467/pexels-photo-4099467.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'Bricolage & Jardin': 'https://images.pexels.com/photos/4503273/pexels-photo-4503273.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'Conseils Quotidien': 'https://images.pexels.com/photos/4239146/pexels-photo-4239146.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'Martinique & Climat': 'https://images.pexels.com/photos/1005417/pexels-photo-1005417.jpeg?auto=compress&cs=tinysrgb&w=1200',
};

function extractJson(text: string): GeneratedArticle {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  const value = JSON.parse(cleaned) as GeneratedArticle;
  if (!value.title?.trim() || !value.excerpt?.trim() || !value.content_markdown?.trim()) {
    throw new Error('The AI response does not contain the required article fields.');
  }

  const category = value.category?.trim() || 'Conseils Quotidien';
  const defaultImage = CATEGORY_IMAGES[category] || CATEGORY_IMAGES['Conseils Quotidien'];

  // Validate or calculate score from quality_report
  const qr = value.quality_report || {};
  const kwScore = Math.min(30, Math.max(0, Number(qr.keyword_density_score) || 20));
  const structScore = Math.min(25, Math.max(0, Number(qr.structure_score) || 20));
  const metaScore = Math.min(25, Math.max(0, Number(qr.seo_meta_score) || 20));
  const readScore = Math.min(20, Math.max(0, Number(qr.readability_score) || 15));
  
  const calculatedTotal = kwScore + structScore + metaScore + readScore;
  const finalScore = typeof value.seo_score === 'number' ? Math.min(100, Math.max(0, value.seo_score)) : calculatedTotal;

  return {
    title: value.title.trim(),
    excerpt: value.excerpt.trim(),
    content_markdown: value.content_markdown.trim(),
    seo_title: value.seo_title?.trim() || undefined,
    seo_description: value.seo_description?.trim() || undefined,
    keywords: Array.isArray(value.keywords)
      ? value.keywords.map((keyword) => String(keyword).trim()).filter(Boolean).slice(0, 12)
      : [],
    category,
    image_url: value.image_url?.trim() || defaultImage,
    seo_score: finalScore,
    quality_report: {
      keyword_density_score: kwScore,
      structure_score: structScore,
      seo_meta_score: metaScore,
      readability_score: readScore,
      feedback: qr.feedback?.trim() || 'Article rédigé et évalué avec succès.',
    },
  };
}

function buildPrompt(settings: ArticleSettings): string {
  const language = settings.language === 'en' ? 'English' : 'French';
  return `You are an expert content writer and SEO auditor. Return only valid JSON, with no Markdown fence.

Write one original SEO article in ${language} and grade it according to an official SEO & Quality Rubric.

Topic: ${settings.topic}
Target audience: ${settings.audience}
Tone: ${settings.tone}
Target length: between ${settings.min_words} and ${settings.max_words} words.

Requirements:
- Be factually cautious: do not invent prices, laws, testimonials, or false company claims.
- Use clean Markdown headings (##, ###) and clear bullet points.
- Select a category among: "Ménage & Repassage", "Bricolage & Jardin", "Conseils Quotidien", "Martinique & Climat".

Grade the generated article objectively on a 100-point scale:
1. Keyword Density Score (0 to 30 points)
2. Structure & Headings Score (0 to 25 points)
3. SEO Meta Title & Description Score (0 to 25 points)
4. Readability & Practical Advice Score (0 to 20 points)
Sum of the 4 scores = total "seo_score" (0 to 100).

Return this exact JSON shape:
{
  "title": "string",
  "category": "string",
  "excerpt": "string, 120 to 220 characters",
  "content_markdown": "string",
  "seo_title": "string, max 60 chars",
  "seo_description": "string, max 155 chars",
  "keywords": ["string"],
  "seo_score": 85,
  "quality_report": {
    "keyword_density_score": 25,
    "structure_score": 22,
    "seo_meta_score": 22,
    "readability_score": 16,
    "feedback": "Detailed feedback on what makes this article score well or what could be improved"
  }
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
          content: 'You are an expert SEO content writer and auditor for web applications. Respond strictly with valid JSON.',
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
      
      // RULE: Automatically publish if score > 50% AND auto_publish setting is enabled
      const autoPublish = settings.auto_publish && article.seo_score > 50;
      const targetStatus = autoPublish ? 'published' : 'draft';

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
          category: article.category || 'Conseils Quotidien',
          image_url: article.image_url || null,
          seo_score: article.seo_score,
          quality_report: article.quality_report,
          generated_date: scheduledFor,
          status: targetStatus,
          published_at: autoPublish ? new Date().toISOString() : null,
        })
        .select('id, status, slug, seo_score')
        .single();
      if (insertError) throw insertError;

      // If score <= 50% or retained as draft, create an admin notification for manual review
      if (!autoPublish) {
        await supabase.from('admin_notifications').insert({
          title: `Article en attente de révision (Score SEO: ${article.seo_score}%)`,
          message: `L'article "${article.title}" a obtenu un score de ${article.seo_score}% (≤ 50%). Il a été retenu en brouillon pour validation manuelle.`,
          type: 'article_review',
          link: '/admin/articles',
        });
      }

      const { error: completedError } = await supabase
        .from('article_generation_runs')
        .update({ status: 'succeeded', article_id: savedArticle.id, completed_at: new Date().toISOString() })
        .eq('id', run.id);
      if (completedError) throw completedError;

      return response({ ok: true, scheduledFor, article: savedArticle, autoPublished: autoPublish });
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
