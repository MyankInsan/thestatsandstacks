import React from 'react';

interface AccentTag {
  tone: string;
  text: string;
}

interface MetaCardProps {
  label: string;
  children: React.ReactNode;
  accentTag?: AccentTag;
}

function MetaCard({ label, children, accentTag }: MetaCardProps) {
  return (
    <section className="meta-card">
      <header className="meta-card__head">
        <span className="meta-card__label mono">{label}</span>
        {accentTag && (
          <span className={`pill pill--${accentTag.tone} mono`}>{accentTag.text}</span>
        )}
      </header>
      <div className="meta-card__body">{children}</div>
    </section>
  );
}

export interface PostData {
  topic: string;
  format: string;
  pillar: string;
  confidence: number;
  caption: string;
  hashtags: string;
  firstComment: string;
  status: string;
  statusTone: string;
  scheduledFor: string;
  timezone: string;
}

export interface PostMetaProps {
  post: PostData;
}

export function PostMeta({ post }: PostMetaProps) {
  return (
    <aside className="post-meta">
      <MetaCard
        label="Topic"
        accentTag={{ tone: 'emerald', text: `${Math.round(post.confidence * 100)}% CONF` }}
      >
        <div className="meta-card__topic">{post.topic}</div>
        <div className="meta-card__chips">
          <span className="pill pill--ghost mono">{post.format}</span>
          <span className="pill pill--ghost mono">{post.pillar}</span>
        </div>
      </MetaCard>

      <MetaCard label="Caption">
        <p className="meta-card__caption">{post.caption}</p>
      </MetaCard>

      <MetaCard label="Hashtags">
        <p className="meta-card__hashtags">{post.hashtags}</p>
      </MetaCard>

      <MetaCard label="First comment">
        <p className="meta-card__small">{post.firstComment}</p>
      </MetaCard>

      <MetaCard
        label="Status"
        accentTag={{ tone: post.statusTone, text: post.status }}
      >
        <div className="meta-card__status-line mono">
          <span>{post.scheduledFor}</span>
          <span>·</span>
          <span>{post.timezone}</span>
        </div>
      </MetaCard>
    </aside>
  );
}
