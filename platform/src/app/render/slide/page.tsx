import React from 'react';
import '../tokens.css';
import '../../../components/slide-templates/slides.css';
import { SLIDE_TEMPLATES, CoverSlide } from '../../../components/slide-templates';

interface PageProps {
  searchParams?: Promise<{ template?: string; props?: string }>;
}

export default async function RenderSlidePage({ searchParams }: PageProps) {
  const params = await (searchParams ?? Promise.resolve({}));
  const templateName = (params as { template?: string }).template ?? 'CoverSlide';
  let props: Record<string, unknown> = {};
  try {
    const rawProps = (params as { props?: string }).props;
    if (rawProps) props = JSON.parse(decodeURIComponent(rawProps));
  } catch {
    // use empty props
  }
  const Component = SLIDE_TEMPLATES[templateName] ?? CoverSlide;
  return (
    <div style={{ width: 1080, height: 1350, overflow: 'hidden', background: '#020617' }}>
      <Component {...props} />
    </div>
  );
}
