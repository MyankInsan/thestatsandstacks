// platform/src/components/slide-templates/index.ts
export { SlideFrame } from './SlideFrame';
export { CoverSlide } from './CoverSlide';
export { PureCoverSlide } from './PureCoverSlide';
export { MarketPosterSlide } from './MarketPosterSlide';
export { FrameworkSlide } from './FrameworkSlide';
export { ComparisonSlide } from './ComparisonSlide';
export { MythVsFactSlide } from './MythVsFactSlide';
export { BigNumberSlide } from './BigNumberSlide';
export { PureStatSlide } from './PureStatSlide';
export { QuoteSlide } from './QuoteSlide';
export { CashflowSlide } from './CashflowSlide';
export { RiskMapSlide } from './RiskMapSlide';
export { OutroSlide } from './OutroSlide';

import { CoverSlide } from './CoverSlide';
import { PureCoverSlide } from './PureCoverSlide';
import { MarketPosterSlide } from './MarketPosterSlide';
import { FrameworkSlide } from './FrameworkSlide';
import { ComparisonSlide } from './ComparisonSlide';
import { MythVsFactSlide } from './MythVsFactSlide';
import { BigNumberSlide } from './BigNumberSlide';
import { PureStatSlide } from './PureStatSlide';
import { QuoteSlide } from './QuoteSlide';
import { CashflowSlide } from './CashflowSlide';
import { RiskMapSlide } from './RiskMapSlide';
import { OutroSlide } from './OutroSlide';
import React from 'react';

export const SLIDE_TEMPLATES: Record<string, React.ComponentType<Record<string, unknown>>> = {
  CoverSlide,
  PureCoverSlide,
  MarketPosterSlide,
  FrameworkSlide,
  ComparisonSlide,
  MythVsFactSlide,
  BigNumberSlide,
  PureStatSlide,
  QuoteSlide,
  CashflowSlide,
  RiskMapSlide,
  OutroSlide,
};
