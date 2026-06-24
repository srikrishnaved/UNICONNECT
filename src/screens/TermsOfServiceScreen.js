import React from 'react';
import LegalScreen from './LegalScreen';

export default function TermsOfServiceScreen() {
  return <LegalScreen route={{ params: { type: 'terms' } }} />;
}
