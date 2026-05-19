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
export { OptionelitySlide } from './OptionelitySlide';

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
import { OptionelitySlide } from './OptionelitySlide';
import React from 'react';

type AnySlide = React.ComponentType<Record<string, unknown>>;

export const SLIDE_TEMPLATES: Record<string, AnySlide> = {
  CoverSlide: CoverSlide as unknown as AnySlide,
  PureCoverSlide: PureCoverSlide as unknown as AnySlide,
  MarketPosterSlide: MarketPosterSlide as unknown as AnySlide,
  FrameworkSlide: FrameworkSlide as unknown as AnySlide,
  ComparisonSlide: ComparisonSlide as unknown as AnySlide,
  MythVsFactSlide: MythVsFactSlide as unknown as AnySlide,
  BigNumberSlide: BigNumberSlide as unknown as AnySlide,
  PureStatSlide: PureStatSlide as unknown as AnySlide,
  QuoteSlide: QuoteSlide as unknown as AnySlide,
  CashflowSlide: CashflowSlide as unknown as AnySlide,
  RiskMapSlide: RiskMapSlide as unknown as AnySlide,
  OutroSlide: OutroSlide as unknown as AnySlide,
  OptionelitySlide: OptionelitySlide as unknown as AnySlide,
};
