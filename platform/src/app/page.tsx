import { PrismaClient } from '@prisma/client';
import './render/tokens.css';
import '../components/dashboard/dashboard.css';
import { Header } from '../components/dashboard/Header';
import { StatBar } from '../components/dashboard/StatBar';
import { BriefModule } from '../components/dashboard/BriefModule';
import { SlideGrid } from '../components/dashboard/SlideGrid';
import { PostMeta } from '../components/dashboard/PostMeta';
import { RegenLoopCard } from '../components/dashboard/RegenLoopCard';
import { PipelineStrip } from '../components/dashboard/PipelineStrip';
import type { AgentConfig } from '../components/dashboard/PipelineStrip';

export const dynamic = 'force-dynamic';
const prisma = new PrismaClient();

export default async function Dashboard() {
  const [postsCount, ideasCount, latestPost] = await Promise.all([
    prisma.post.count(),
    prisma.contentIdea.count(),
    prisma.post.findFirst({
      orderBy: { createdAt: 'desc' },
      include: {
        brief: true,
        Assets: { include: { asset: true }, orderBy: { orderIndex: 'asc' } },
      },
    }),
  ]);

  const [agentRuns, regenAttempts] = latestPost
    ? await Promise.all([
        prisma.agentRun.findMany({
          where: { postId: latestPost.id },
          orderBy: { startedAt: 'asc' },
        }),
        prisma.regenAttempt.findMany({ where: { postId: latestPost.id } }),
      ])
    : [[], []];

  const qaScore = latestPost
    ? `${(latestPost.confidenceScore * 100).toFixed(0)}%`
    : '—';

  const brief = latestPost?.brief
    ? {
        hotTopic: latestPost.brief.hook,
        research: `${latestPost.Assets?.length ?? 0} slides generated`,
        format: latestPost.brief.format,
        layout: Array.isArray(latestPost.brief.outline)
          ? (latestPost.brief.outline as string[]).slice(0, 3).join(' · ')
          : String(latestPost.brief.outline ?? ''),
        compliance: 'Educational frame only · no buy/sell language',
      }
    : null;

  const slides = (latestPost?.Assets ?? []).map((pa, i) => ({
    bg: 'linear-gradient(135deg,#06101D,#0d1b2a 55%,#111111)',
    eyebrow: `SLIDE ${String(i + 1).padStart(2, '0')}`,
    headline: latestPost?.brief?.hook ?? '—',
    viz: 'quote' as const,
    qa: pa.asset.visionScore ?? 0,
  }));

  const postMeta = latestPost
    ? {
        topic: latestPost.brief?.hook ?? '—',
        format: latestPost.brief?.format ?? '—',
        pillar: 'MARKET EDUCATION',
        confidence: latestPost.confidenceScore,
        caption: latestPost.caption,
        hashtags: latestPost.hashtags,
        firstComment: latestPost.firstComment ?? '',
        scheduledFor: latestPost.publishDate
          ? latestPost.publishDate.toLocaleString('en-CA', {
              timeZone: 'America/Vancouver',
            })
          : '—',
        timezone: 'PT',
        status: latestPost.status,
        statusTone: (latestPost.status === 'PUBLISHED'
          ? 'emerald'
          : latestPost.status === 'FAILED'
          ? 'rose'
          : 'amber') as 'emerald' | 'rose' | 'amber',
      }
    : null;

  const regenEntries = regenAttempts.map((r) => ({
    slide: r.slideNumber,
    status: (r.resolved ? 'resolved' : 'retrying') as
      | 'resolved'
      | 'retrying'
      | 'fallback',
    attempts: r.attempt,
    cap: 5,
    before: {
      score: r.scoreBefore,
      bg: 'linear-gradient(135deg,#06101D,#0d1b2a 55%,#111111)',
    },
    after: {
      score: r.scoreAfter,
      bg: 'linear-gradient(135deg,#06101D,#0d1b2a 55%,#111111)',
    },
    notes: (r.critique as Array<{ severity: string; body: string }>).map(
      (c) => ({ severity: c.severity, text: c.body })
    ),
  }));

  const agents: AgentConfig[] | undefined = agentRuns.length
    ? agentRuns.map((r) => ({
        name: agentDisplayName(r.agent),
        icon: agentIcon(r.agent),
        status: agentStatus(r.status),
      }))
    : undefined;

  return (
    <div className="tss">
      <Header />
      <main className="dash-main">
        <StatBar posts={postsCount} ideas={ideasCount} qa={qaScore} />
        {brief && <BriefModule brief={brief} />}
        <div className="main-row">
          <SlideGrid slides={slides} />
          {postMeta && <PostMeta post={postMeta} />}
        </div>
        {regenEntries.length > 0 && <RegenLoopCard entries={regenEntries} />}
        <PipelineStrip agents={agents} />
      </main>
    </div>
  );
}

function agentDisplayName(name: string): string {
  const map: Record<string, string> = {
    CostGuardAgent: 'Cost Guard',
    HotTopicDeskAgent: 'Hot Topic Desk',
    TickersInNewsAgent: 'Tickers in News',
    TrendResearchAgent: 'Trend Research',
    HistoryGuardAgent: 'History Guard',
    ContentStrategyAgent: 'Strategy',
    MediaFormatDecisionAgent: 'Format Decider',
    ReelPlannerAgent: 'Reel Planner',
    EditorialAgent: 'Editorial',
    ComplianceQAAgent: 'Compliance',
    ImagePromptAgent: 'Image Prompts',
    ImageGenerationAgent: 'Image / Video',
    SoundDesignAgent: 'Sound Design',
    VisionQAAgent: 'Vision Critic',
    RegenLoopAgent: 'Regen Loop',
    CopywritingAgent: 'Copywriter',
    FinalGateAgent: 'Final Gate',
    PublisherAgent: 'Publisher',
  };
  return map[name] ?? name;
}

function agentIcon(name: string): string {
  const map: Record<string, string> = {
    CostGuardAgent: '◎',
    HotTopicDeskAgent: '🔥',
    TickersInNewsAgent: '📰',
    TrendResearchAgent: '🔍',
    HistoryGuardAgent: '🧬',
    ContentStrategyAgent: '🧠',
    MediaFormatDecisionAgent: '🧭',
    ReelPlannerAgent: '🎬',
    EditorialAgent: '🗞️',
    ComplianceQAAgent: '✓',
    ImagePromptAgent: '🎨',
    ImageGenerationAgent: '🖼️',
    SoundDesignAgent: '🎚️',
    VisionQAAgent: '🔎',
    RegenLoopAgent: '↻',
    CopywritingAgent: '✍️',
    FinalGateAgent: '🛡️',
    PublisherAgent: '🚀',
  };
  return map[name] ?? '◉';
}

function agentStatus(status: string): 'done' | 'running' | 'idle' {
  if (status === 'DONE' || status === 'done' || status === 'COMPLETE' || status === 'SUCCESS') return 'done';
  if (status === 'RUNNING' || status === 'running' || status === 'IN_PROGRESS') return 'running';
  return 'idle';
}
