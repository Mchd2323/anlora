import React from 'react';
import { WordStatusActions, WordStatusActionsProps } from './WordStatusActions';

export interface LearningStatusControlProps extends WordStatusActionsProps {}

export const LearningStatusControl: React.FC<LearningStatusControlProps> = (props) => {
  return <WordStatusActions {...props} />;
};

export { WordStatusActions };
