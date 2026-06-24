import React from 'react';
import LegalScreen from './LegalScreen';

export default function PrivacyPolicyScreen() {
  return <LegalScreen route={{ params: { type: 'privacy' } }} />;
}
