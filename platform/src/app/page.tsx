import { PrismaClient } from "@prisma/client";
import { RunWorkflowButton } from "@/components/RunWorkflowButton";
import Image from "next/image";

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const latestPost = await prisma.post.findFirst({
    orderBy: { createdAt: "desc" },
    include: { 
      brief: true,
      Assets: { 
        include: { asset: true },
        orderBy: { orderIndex: 'asc' }
      }
    },
  });

  const postsCount = await prisma.post.count();
  const ideasCount = await prisma.contentIdea.count();

  return (
    <div className="min-h-screen bg-[#0B1120]">
      {/* Header */}
      <header className="bg-[#0F172A] border-b border-slate-800 p-5">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              The<span className="text-emerald-400">Stats</span>And<span className="text-amber-400">Stacks</span>
            </h1>
          </div>
          <div className="flex gap-3 items-center">
            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-full font-mono">
              SYSTEM ONLINE
            </span>
            <RunWorkflowButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-white">{postsCount}</p>
            <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">Posts Created</p>
          </div>
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-white">{ideasCount}</p>
            <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">Ideas Researched</p>
          </div>
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-emerald-400">
              {latestPost ? `${(latestPost.confidenceScore * 100).toFixed(0)}%` : '—'}
            </p>
            <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">QA Score</p>
          </div>
        </div>

        {latestPost ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Images */}
            <div className="lg:col-span-2 bg-[#0F172A] border border-slate-800 rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-white">Generated Slides</h2>
                <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded font-mono">
                  {latestPost.Assets?.length || 0} slides
                </span>
              </div>

              {latestPost.Assets && latestPost.Assets.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {latestPost.Assets.map((postAsset, i) => (
                    <div key={postAsset.id} className="relative group">
                      <Image
                        src={postAsset.asset.imageUrl}
                        alt={`Slide ${i + 1}`}
                        width={1080}
                        height={1350}
                        unoptimized
                        className="w-full aspect-[4/5] object-cover rounded-lg border border-slate-700 group-hover:border-emerald-500 transition-colors"
                      />
                      <div className="absolute top-2 left-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded font-mono">
                        SLIDE {i + 1}
                      </div>
                      {postAsset.asset.visionScore && (
                        <div className={`absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded font-mono ${
                          postAsset.asset.visionScore >= 0.8 
                            ? 'bg-emerald-500/20 text-emerald-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          QA: {(postAsset.asset.visionScore * 100).toFixed(0)}%
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">No images generated yet.</p>
              )}
            </div>

            {/* Right: Post Details */}
            <div className="space-y-4">
              {/* Topic Card */}
              <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5">
                <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2">Topic</h3>
                <p className="text-white font-medium text-sm">{latestPost.brief?.hook}</p>
                <div className="flex gap-2 mt-3">
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    {latestPost.brief?.format}
                  </span>
                  <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                    {(latestPost.confidenceScore * 100).toFixed(0)}% confidence
                  </span>
                </div>
              </div>

              {/* Caption Card */}
              <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5">
                <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2">Caption</h3>
                <p className="text-slate-300 text-xs whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                  {latestPost.caption}
                </p>
              </div>

              {/* Hashtags Card */}
              <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5">
                <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2">Hashtags</h3>
                <p className="text-emerald-400/80 text-xs break-words">
                  {latestPost.hashtags}
                </p>
              </div>

              {/* First Comment Card */}
              {latestPost.firstComment && (
                <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5">
                  <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2">First Comment</h3>
                  <p className="text-slate-300 text-xs">{latestPost.firstComment}</p>
                </div>
              )}

              {/* Status */}
              <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5">
                <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2">Status</h3>
                <p className="text-amber-400 text-sm font-mono">{latestPost.status}</p>
                <p className="text-slate-600 text-[10px] mt-1">
                  Created {latestPost.createdAt.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-12 text-center">
            <p className="text-slate-500 text-sm">No posts generated yet.</p>
            <p className="text-slate-600 text-xs mt-2">Click &quot;Run Full Pipeline&quot; to generate your first post.</p>
          </div>
        )}

        {/* Agent Pipeline Status */}
        <div className="mt-8 bg-[#0F172A] border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Agent Pipeline</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-9 gap-3">
            {[
              { name: 'Cost Guard', icon: '◎' },
              { name: 'Trend Research', icon: '🔍' },
              { name: 'Strategy', icon: '🧠' },
              { name: 'Compliance', icon: '✓' },
              { name: 'Image Prompts', icon: '🎨' },
              { name: 'Image Gen', icon: '🖼️' },
              { name: 'Vision QA', icon: '🔎' },
              { name: 'Copywriter', icon: '✍️' },
            ].map((agent, i) => (
              <div key={i} className="bg-[#1E293B] rounded-lg p-3 text-center border border-slate-700">
                <p className="text-lg">{agent.icon}</p>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">{agent.name}</p>
                <div className="w-full h-0.5 bg-emerald-500/30 rounded mt-2">
                  <div className="h-full bg-emerald-400 rounded" style={{ width: '100%' }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
